import type { SeriesType } from "@/generated/prisma/client";
import type { ZodType } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import type { AppSession } from "@/lib/auth/types";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

interface DocumentItemInput {
  productId: string;
  [key: string]: unknown;
}

interface DocumentCreateInput {
  warehouseId?: string;
  items: DocumentItemInput[];
  [key: string]: unknown;
}

export interface DocumentMainDelegate {
  count(args: { where?: Record<string, unknown> }): Promise<number>;
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
}

export interface DocumentItemDelegate {
  findMany(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
}

export interface DocumentResourceConfig<TCreate extends DocumentCreateInput> {
  name: string;
  module: string;
  seriesType: SeriesType;
  createSchema: ZodType<TCreate>;
  getMainDelegate: (client: unknown) => DocumentMainDelegate;
  getItemDelegate: (client: unknown) => DocumentItemDelegate;
  /** Fields for the _main row, minus id/documentNumber/financialYearId/storeId/createdByUserId/createdAt/items — those are added automatically. */
  buildMainData: (data: TCreate) => Record<string, unknown>;
  /** Fields for one _item row, minus id/product snapshot fields/the FK back to _main — those are added automatically. */
  buildItemData: (item: TCreate["items"][number]) => Record<string, unknown>;
  /** Returns an error message to reject the whole create, or null to allow it. */
  validateItem?: (
    item: TCreate["items"][number],
    data: TCreate,
    tx: unknown,
  ) => Promise<string | null>;
  afterCreate?: (
    tx: unknown,
    main: Record<string, unknown>,
    items: Record<string, unknown>[],
    session: AppSession,
  ) => Promise<void>;
}

class ValidationError extends Error {}

function toCamelCase(snakeCase: string): string {
  return snakeCase.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

async function requireSession(module: string, action: string) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return { error: apiErrorResponse("unauthorized", "You must be signed in.", 401) } as const;
  }
  if (!hasPermission(session.user.permissions, module, action)) {
    return {
      error: apiErrorResponse(
        "forbidden",
        `You don't have permission to ${action} ${module}.`,
        403,
      ),
    } as const;
  }
  return { session } as const;
}

export function defineDocumentResource<TCreate extends DocumentCreateInput>(
  config: DocumentResourceConfig<TCreate>,
) {
  const mainIdField = `${toCamelCase(config.name)}MainId`;

  async function GET(request: Request) {
    const authResult = await requireSession(config.module, "view");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
    const storeIdFilter = url.searchParams.get("storeId") ?? undefined;

    return withStoreContext(async () => {
      const mainDelegate = config.getMainDelegate(unscoped());
      const where = storeIdFilter
        ? { storeId: storeIdFilter }
        : session.user.storeId
          ? { storeId: session.user.storeId }
          : {};

      const totalRecords = await mainDelegate.count({ where });
      const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
      const data = await mainDelegate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return Response.json({ totalRecords, totalPages, page, pageSize, data });
    });
  }

  async function getOne(_request: Request, id: string) {
    const authResult = await requireSession(config.module, "view");
    if ("error" in authResult) return authResult.error;

    return withStoreContext(async () => {
      const mainDelegate = config.getMainDelegate(unscoped());
      const itemDelegate = config.getItemDelegate(unscoped());
      const main = await mainDelegate.findUnique({ where: { id } });
      if (!main) return apiErrorResponse("not_found", "Record not found.", 404);

      const items = await itemDelegate.findMany({
        where: { [mainIdField]: id },
      });
      return Response.json({ ...main, items });
    });
  }

  async function POST(request: Request) {
    const authResult = await requireSession(config.module, "create");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    if (!session.user.financialYearId) {
      return apiErrorResponse("bad_request", "Select a financial year first.", 400);
    }
    if (!session.user.storeId) {
      return apiErrorResponse(
        "forbidden",
        "A Super Admin session has no single store — sign in as a store user to create documents.",
        403,
      );
    }

    const parsed = await parseJsonOrRespond(request, config.createSchema);
    if ("response" in parsed) return parsed.response;
    const data = parsed.data;

    if (data.items.length === 0) {
      return apiErrorResponse("bad_request", "At least one item is required.", 400);
    }

    return withStoreContext(async () => {
      try {
        const result = await unscoped().$transaction(async (tx) => {
          for (const item of data.items) {
            const message = await config.validateItem?.(item, data, tx);
            if (message) throw new ValidationError(message);
          }

          const { documentNumber } = await allocateDocumentNumber(tx, {
            seriesType: config.seriesType,
            storeId: session.user.storeId!,
            financialYearId: session.user.financialYearId!,
          });

          const products = await tx.product.findMany({
            where: { id: { in: data.items.map((item) => item.productId) } },
            include: { hsnCode: { select: { hsnCode: true } } },
          });
          const productById = new Map(products.map((p) => [p.id, p]));

          const mainDelegate = config.getMainDelegate(tx);
          const main = await mainDelegate.create({
            data: {
              ...config.buildMainData(data),
              documentNumber,
              financialYearId: session.user.financialYearId,
              storeId: session.user.storeId,
              createdByUserId: session.user.id,
            },
          });

          const itemDelegate = config.getItemDelegate(tx);
          const items: Record<string, unknown>[] = [];
          for (const item of data.items) {
            const product = productById.get(item.productId);
            if (!product) throw new ValidationError(`Unknown product: ${item.productId}`);
            const created = await itemDelegate.create({
              data: {
                ...config.buildItemData(item),
                [mainIdField]: main.id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
              },
            });
            items.push(created);
          }

          if (config.afterCreate) {
            await config.afterCreate(tx, main, items, session);
          }

          return { main, items };
        });

        await writeAuditLog({
          userId: session.user.id,
          storeId: session.user.storeId,
          action: "create",
          entityType: config.name,
          entityId: String(result.main.id),
          afterData: result,
        });

        return Response.json(result, { status: 201 });
      } catch (error) {
        if (error instanceof ValidationError) {
          return apiErrorResponse("bad_request", error.message, 400);
        }
        throw error;
      }
    });
  }

  return { GET, POST, getOne };
}
