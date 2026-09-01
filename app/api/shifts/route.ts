import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { shiftOpenSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
    };

    const totalRecords = await db.shift.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const data = await db.shift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        terminal: { select: { name: true } },
        cashierUser: { select: { name: true } },
      },
    });
    return Response.json({ totalRecords, totalPages, page, pageSize, data });
  });
}

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to open a shift.", 403);
  }
  if (!session.user.storeId || !session.user.financialYearId) {
    return apiErrorResponse("bad_request", "Select a store and financial year first.", 400);
  }

  const parsed = await parseJsonOrRespond(request, shiftOpenSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const terminal = await db.terminal.findUnique({ where: { id: data.terminalId } });
    if (!terminal || terminal.storeId !== session.user.storeId) {
      return apiErrorResponse("bad_request", "Select a terminal belonging to your store.", 400);
    }

    const existingOpen = await db.shift.findFirst({
      where: { terminalId: data.terminalId, cashierUserId: session.user.id, status: "open" },
    });
    if (existingOpen) {
      return apiErrorResponse(
        "bad_request",
        "You already have an open shift on this terminal.",
        400,
      );
    }

    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "shift",
        storeId: session.user.storeId!,
        financialYearId: session.user.financialYearId!,
      });

      const shift = await tx.shift.create({
        data: {
          terminalId: data.terminalId,
          cashierUserId: session.user.id,
          storeId: session.user.storeId!,
          documentNumber,
          financialYearId: session.user.financialYearId!,
          status: "open",
          openingFloat: data.openingFloat,
          openedAt: new Date(),
        },
      });

      if (data.openingCounts && data.openingCounts.length > 0) {
        await tx.shiftCashCount.createMany({
          data: data.openingCounts.map((c) => ({
            shiftId: shift.id,
            denominationId: c.denominationId,
            countType: "opening",
            quantityCounted: c.quantityCounted,
          })),
        });
      }

      return shift;
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "shift",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
