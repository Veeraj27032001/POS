import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { isSourceItemType, SOURCE_TYPE_CONFIG } from "@/lib/documents/entryCorrectionSourceTypes";
import { stockEntryCorrectionCreateSchema } from "@/lib/documents/schemas";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

async function requireSession(action: string) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return { error: apiErrorResponse("unauthorized", "You must be signed in.", 401) } as const;
  }
  if (!hasPermission(session.user.permissions, "stock", action)) {
    return {
      error: apiErrorResponse("forbidden", `You don't have permission to ${action} stock.`, 403),
    } as const;
  }
  return { session } as const;
}

export async function GET(request: Request) {
  const authResult = await requireSession("view");
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
    };

    const totalRecords = await db.stockEntryCorrection.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const data = await db.stockEntryCorrection.findMany({
      where,
      orderBy: { correctedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return Response.json({ totalRecords, totalPages, page, pageSize, data });
  });
}

export async function POST(request: Request) {
  const authResult = await requireSession("create");
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

  const parsed = await parseJsonOrRespond(request, stockEntryCorrectionCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  if (!isSourceItemType(data.sourceItemType)) {
    return apiErrorResponse("bad_request", "Unknown sourceItemType.", 400);
  }
  const config = SOURCE_TYPE_CONFIG[data.sourceItemType];

  return withStoreContext(async () => {
    const rawDb = unscoped() as unknown as Record<
      string,
      {
        findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
        update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
      }
    >;
    const item = await rawDb[config.itemDelegate].findUnique({
      where: { id: data.sourceItemId },
    });
    if (!item) {
      return apiErrorResponse("bad_request", "Source item not found.", 400);
    }
    const mainId = item[config.itemMainIdField] as string;
    const main = await rawDb[config.mainDelegate].findUnique({ where: { id: mainId } });
    if (!main || (session.user.storeId && main.storeId !== session.user.storeId)) {
      return apiErrorResponse("bad_request", "Source item not found.", 400);
    }

    const previousValue = item[config.correctableField] as number;
    if (data.newValue === previousValue) {
      return apiErrorResponse("bad_request", "New value is the same as the current value.", 400);
    }

    const warehouseId = main.warehouseId as string;
    const { available } = await getStockLevels({
      productId: item.productId as string,
      warehouseId,
    });
    const resultingAvailable = available + config.sign * (data.newValue - previousValue);
    if (resultingAvailable < 0) {
      return apiErrorResponse(
        "bad_request",
        `This correction would leave ${resultingAvailable} available at this warehouse (already consumed elsewhere).`,
        400,
      );
    }

    const db = unscoped();
    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "entry_correction",
        storeId: session.user.storeId!,
        financialYearId: session.user.financialYearId!,
      });

      const rawTx = tx as unknown as Record<
        string,
        { update: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }
      >;
      await rawTx[config.itemDelegate].update({
        where: { id: data.sourceItemId },
        data: { [config.correctableField]: data.newValue },
      });

      return tx.stockEntryCorrection.create({
        data: {
          documentNumber,
          financialYearId: session.user.financialYearId!,
          storeId: session.user.storeId!,
          sourceItemType: data.sourceItemType,
          sourceItemId: data.sourceItemId,
          fieldCorrected: config.correctableField,
          previousValue,
          newValue: data.newValue,
          notes: data.notes ?? null,
          correctedByUserId: session.user.id,
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "stock_entry_correction",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
