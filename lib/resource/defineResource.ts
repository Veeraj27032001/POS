import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { prisma, unscoped } from "@/lib/db";
import { withStoreContext } from "@/middleware/scope";
import { writeAuditLog } from "@/lib/security/audit";
import { parseListQueryParams } from "@/lib/pagination/queryParams";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { Prisma } from "@/generated/prisma/client";

import { isResourceHookRejection } from "./types";

/** P2002's `meta` shape differs by Prisma version/driver: classic engines
 * populate `meta.target` directly, while the driver-adapter path (in use
 * here) instead nests the DB's own constraint info under
 * `meta.driverAdapterError.cause.constraint.fields`. Check both. */
function extractUniqueFields(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];
  const target = meta.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === "string") return [target];

  const driverAdapterError = meta.driverAdapterError as
    { cause?: { constraint?: { fields?: unknown } } } | undefined;
  const driverFields = driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(driverFields) ? (driverFields as string[]) : [];
}

function uniqueConstraintResponse(error: unknown, uniqueFieldLabels?: Record<string, string>) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null;
  }
  const rawFields = extractUniqueFields(error.meta);
  const labels = rawFields.map((raw) => {
    if (uniqueFieldLabels?.[raw]) return uniqueFieldLabels[raw];
    const camel = raw.replace(/_([a-z])/g, (_match: string, letter: string) =>
      letter.toUpperCase(),
    );
    return uniqueFieldLabels?.[camel] ?? null;
  });
  const message =
    labels.length > 0 && labels.every((label): label is string => label !== null)
      ? `A record with this ${labels.join(", ")} already exists.`
      : "A record with this value already exists.";
  return apiErrorResponse("conflict", message, 409);
}
import type { ResourceConfig, ResourceDelegate } from "./types";

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

function buildSearchWhere(searchFields: string[] | undefined, search: string | undefined) {
  if (!search || !searchFields || searchFields.length === 0) return undefined;
  return {
    OR: searchFields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" as const },
    })),
  };
}

export function defineResource<TCreate, TUpdate>(config: ResourceConfig<TCreate, TUpdate>) {
  const supportsSoftDelete = config.hasIsActive !== false;
  function notDeletedWhere(): Record<string, unknown> {
    return supportsSoftDelete ? { isDeleted: false } : {};
  }

  async function resolveDelegate(
    storeId: string | null,
  ): Promise<{ delegate: ResourceDelegate; scopeWhere?: Record<string, unknown> }> {
    if (config.scoping === "none") {
      return { delegate: config.getDelegate(unscoped()) };
    }
    if (config.scoping === "optional") {
      return {
        delegate: config.getDelegate(unscoped()),
        scopeWhere: storeId ? { OR: [{ storeId }, { storeId: null }] } : undefined,
      };
    }
    return { delegate: config.getDelegate(prisma) };
  }

  async function GET(request: Request) {
    const authResult = await requireSession(config.module, "view");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const url = new URL(request.url);
    const params = parseListQueryParams(url.searchParams);
    const searchWhere = buildSearchWhere(config.searchFields, params.search);

    const run = async () => {
      const { delegate, scopeWhere } = await resolveDelegate(session.user.storeId);
      const where = {
        ...scopeWhere,
        ...searchWhere,
        ...params.filters,
        ...notDeletedWhere(),
        ...(config.extraWhere?.(session) ?? {}),
      };

      const totalRecords = await delegate.count({ where });
      const totalPages = Math.max(1, Math.ceil(totalRecords / params.pageSize));
      const page = Math.min(Math.max(1, params.page), totalPages);

      if (url.searchParams.get("countOnly") === "1") {
        return NextResponse.json({
          totalRecords,
          totalPages,
          page,
          pageSize: params.pageSize,
          data: [],
        });
      }

      const data = await delegate.findMany({
        where,
        orderBy: config.defaultSort,
        skip: (page - 1) * params.pageSize,
        take: params.pageSize,
      });
      return NextResponse.json({ totalRecords, totalPages, page, pageSize: params.pageSize, data });
    };

    return withStoreContext(run);
  }

  async function POST(request: Request) {
    const authResult = await requireSession(config.module, "create");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const parsed = await parseJsonOrRespond(request, config.createSchema);
    if ("response" in parsed) return parsed.response;

    const run = async () => {
      const { delegate } = await resolveDelegate(session.user.storeId);
      const originalData = parsed.data as Record<string, unknown>;
      let data = originalData;
      if (config.scoping === "required" && !config.explicitStoreId) {
        data.storeId = session.user.storeId;
      }
      if (config.beforeCreate) {
        const result = await config.beforeCreate(data, session);
        if (isResourceHookRejection(result)) {
          return apiErrorResponse("forbidden", result.forbidden, 403);
        }
        data = result;
      }

      let created: Record<string, unknown>;
      try {
        created = await delegate.create({ data });
      } catch (error) {
        const conflict = uniqueConstraintResponse(error, config.uniqueFieldLabels);
        if (conflict) return conflict;
        throw error;
      }

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "create",
        entityType: config.name,
        entityId: String(created.id),
        afterData: created,
      });

      if (config.afterCreate) {
        await config.afterCreate(created, originalData, session);
      }

      return NextResponse.json(created, { status: 201 });
    };

    return withStoreContext(run);
  }

  async function getOne(_request: Request, id: string) {
    const authResult = await requireSession(config.module, "view");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const run = async () => {
      const { delegate, scopeWhere } = await resolveDelegate(session.user.storeId);
      const record = await delegate.findUnique({
        where: { id, ...scopeWhere, ...notDeletedWhere(), ...(config.extraWhere?.(session) ?? {}) },
      });
      if (!record) return apiErrorResponse("not_found", "Record not found.", 404);
      return NextResponse.json(record);
    };

    return withStoreContext(run);
  }

  async function patchOne(request: Request, id: string) {
    const authResult = await requireSession(config.module, "update");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const parsed = await parseJsonOrRespond(request, config.updateSchema);
    if ("response" in parsed) return parsed.response;

    const run = async () => {
      const { delegate, scopeWhere } = await resolveDelegate(session.user.storeId);
      const existing = await delegate.findUnique({
        where: { id, ...scopeWhere, ...notDeletedWhere(), ...(config.extraWhere?.(session) ?? {}) },
      });
      if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);

      let data = parsed.data as Record<string, unknown>;
      if (config.beforeUpdate) {
        const result = await config.beforeUpdate(data, existing, session);
        if (isResourceHookRejection(result)) {
          return apiErrorResponse("forbidden", result.forbidden, 403);
        }
        data = result;
      }

      let updated: Record<string, unknown>;
      try {
        updated = await delegate.update({ where: { id }, data });
      } catch (error) {
        const conflict = uniqueConstraintResponse(error, config.uniqueFieldLabels);
        if (conflict) return conflict;
        throw error;
      }
      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "update",
        entityType: config.name,
        entityId: id,
        beforeData: existing as never,
        afterData: updated as never,
      });

      if (config.afterUpdate) {
        await config.afterUpdate(updated, existing, session);
      }

      return NextResponse.json(updated);
    };

    return withStoreContext(run);
  }

  async function toggleActiveOne(_request: Request, id: string) {
    const authResult = await requireSession(config.module, "update");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const run = async () => {
      const { delegate, scopeWhere } = await resolveDelegate(session.user.storeId);
      const existing = await delegate.findUnique({
        where: { id, ...scopeWhere, ...notDeletedWhere(), ...(config.extraWhere?.(session) ?? {}) },
      });
      if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);

      if (!supportsSoftDelete) {
        return NextResponse.json(existing);
      }

      const nextActive = !(existing.isActive ?? true);
      const updated = await delegate.update({ where: { id }, data: { isActive: nextActive } });

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "update",
        entityType: config.name,
        entityId: id,
        beforeData: existing,
        afterData: updated,
      });
      return NextResponse.json(updated);
    };

    return withStoreContext(run);
  }

  async function deleteOne(_request: Request, id: string) {
    const authResult = await requireSession(config.module, "delete");
    if ("error" in authResult) return authResult.error;
    const { session } = authResult;

    const run = async () => {
      const { delegate, scopeWhere } = await resolveDelegate(session.user.storeId);
      const existing = await delegate.findUnique({
        where: { id, ...scopeWhere, ...notDeletedWhere(), ...(config.extraWhere?.(session) ?? {}) },
      });
      if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);

      if (!supportsSoftDelete) {
        return apiErrorResponse("not_supported", "This record cannot be deleted.", 400);
      }

      const updated = await delegate.update({ where: { id }, data: { isDeleted: true } });

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "delete",
        entityType: config.name,
        entityId: id,
        beforeData: existing,
        afterData: updated,
      });
      return NextResponse.json(updated);
    };

    return withStoreContext(run);
  }

  return { GET, POST, getOne, patchOne, deleteOne, toggleActiveOne };
}
