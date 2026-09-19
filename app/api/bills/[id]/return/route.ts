import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billReturnCreateSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        lines: { where: { status: "active" }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "completed") {
      return apiErrorResponse("bad_request", `Can't return items from a ${bill.status} bill.`, 400);
    }

    const returnedAgg = await db.billReturnLine.groupBy({
      by: ["billLineId"],
      where: { billLine: { billId: id } },
      _sum: { quantity: true },
    });
    const returnedByLine = new Map(returnedAgg.map((r) => [r.billLineId, r._sum.quantity ?? 0]));

    const warehouses = await db.warehouse.findMany({
      where: { storeId: bill.storeId, isActive: true, isDeleted: false },
      select: { id: true, name: true },
    });

    return Response.json({
      bill: {
        id: bill.id,
        documentNumber: bill.documentNumber,
        storeId: bill.storeId,
        customerId: bill.customerId,
      },
      lines: bill.lines.map((line) => {
        const alreadyReturned = returnedByLine.get(line.id) ?? 0;
        return {
          id: line.id,
          productName: line.productName,
          productBarcode: line.productBarcode,
          unitPrice: line.unitPrice,
          quantitySold: line.quantity,
          alreadyReturned,
          remaining: line.quantity - alreadyReturned,
        };
      }),
      warehouses,
    });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to create bill returns.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billReturnCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "completed") {
      return apiErrorResponse("bad_request", `Can't return items from a ${bill.status} bill.`, 400);
    }

    const reasonCode = await db.reasonCode.findUnique({ where: { id: data.reasonCodeId } });
    if (!reasonCode || reasonCode.category !== "return") {
      return apiErrorResponse("bad_request", "Select a valid return reason.", 400);
    }

    const lineIds = [...new Set(data.lines.map((l) => l.billLineId))];
    const activeLines = await db.billLine.findMany({
      where: { id: { in: lineIds }, billId: id, status: "active" },
    });
    const lineById = new Map(activeLines.map((l) => [l.id, l]));
    for (const lineId of lineIds) {
      if (!lineById.has(lineId)) {
        return apiErrorResponse(
          "bad_request",
          "One of the selected lines isn't on this bill.",
          400,
        );
      }
    }

    const storeWarehouses = await db.warehouse.findMany({
      where: { storeId: bill.storeId, isActive: true, isDeleted: false },
      select: { id: true },
    });
    const validWarehouseIds = new Set(storeWarehouses.map((w) => w.id));
    for (const line of data.lines) {
      if (!validWarehouseIds.has(line.warehouseId)) {
        return apiErrorResponse(
          "bad_request",
          "One of the selected storage locations is invalid.",
          400,
        );
      }
    }

    const returnedAgg = await db.billReturnLine.groupBy({
      by: ["billLineId"],
      where: { billLineId: { in: lineIds } },
      _sum: { quantity: true },
    });
    const alreadyReturnedByLine = new Map(
      returnedAgg.map((r) => [r.billLineId, r._sum.quantity ?? 0]),
    );
    const requestedByLine = new Map<string, number>();
    for (const line of data.lines) {
      requestedByLine.set(
        line.billLineId,
        (requestedByLine.get(line.billLineId) ?? 0) + line.quantity,
      );
    }
    for (const [billLineId, requestedQty] of requestedByLine) {
      const billLine = lineById.get(billLineId)!;
      const alreadyReturned = alreadyReturnedByLine.get(billLineId) ?? 0;
      const remaining = billLine.quantity - alreadyReturned;
      if (requestedQty > remaining) {
        return apiErrorResponse(
          "bad_request",
          `Only ${remaining} of ${billLine.productName} can still be returned.`,
          400,
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "bill_return",
        storeId: bill.storeId,
        financialYearId: bill.financialYearId,
      });

      const billReturn = await tx.billReturn.create({
        data: {
          billId: id,
          reasonCodeId: data.reasonCodeId,
          documentNumber,
          financialYearId: bill.financialYearId,
          storeId: bill.storeId,
          processedByUserId: session.user.id,
        },
      });

      await tx.billReturnLine.createMany({
        data: data.lines.map((line) => ({
          returnId: billReturn.id,
          billLineId: line.billLineId,
          quantity: line.quantity,
          condition: line.condition,
          warehouseId: line.warehouseId,
        })),
      });

      return billReturn;
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "bill_return",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
