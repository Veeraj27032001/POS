import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  blockLineAllocations,
  releaseBillLineAllocations,
  replaceBillLineAllocations,
} from "@/lib/billing/allocateBillLineStock";
import { getStoreWideAvailable } from "@/lib/billing/getStoreWideAvailable";
import { getWarehouseAvailability } from "@/lib/billing/getWarehouseAvailability";
import { loadEditableLine } from "@/lib/billing/loadEditableLine";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveAllocations } from "@/lib/billing/resolveAllocations";
import { resolveTax } from "@/lib/billing/resolveTax";
import { billLineQuantitySchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Manual quantity override — the bulk-entry escape hatch alongside repeated
// scanning (step5 §7.6).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id, lineId } = await params;
  const parsed = await parseJsonOrRespond(request, billLineQuantitySchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const loaded = await loadEditableLine(db, id, lineId, session.user.storeId);
    if ("error" in loaded) return loaded.error;
    const { line } = loaded;

    const product = await db.product.findUnique({
      where: { id: line.productId },
      include: { hsnCode: true },
    });
    if (!product) return apiErrorResponse("bad_request", "Product not found.", 400);

    const isHeld = line.bill.status === "held";

    const perWarehouse = product.stockTracked
      ? await getWarehouseAvailability(line.bill.storeId, line.productId)
      : [];

    // On a held bill, this line's current block already subtracts from
    // `available` — add it back so editing it isn't checked against its
    // own reservation.
    let effectivePerWarehouse = perWarehouse;
    if (isHeld && product.stockTracked) {
      const existingAllocations = await db.billLineWarehouseAllocation.findMany({
        where: { billLineId: lineId },
      });
      const selfBlocked = new Map<string, number>();
      await Promise.all(
        existingAllocations.map(async (alloc) => {
          const agg = await db.stockBlockItem.aggregate({
            _sum: { quantityBlocked: true },
            where: {
              status: "active",
              stockBlockMain: { sourceType: "draft_bill_line", sourceId: alloc.id },
            },
          });
          const qty = agg._sum.quantityBlocked ?? 0;
          selfBlocked.set(alloc.warehouseId, (selfBlocked.get(alloc.warehouseId) ?? 0) + qty);
        }),
      );
      effectivePerWarehouse = perWarehouse.map((w) => ({
        ...w,
        available: w.available + (selfBlocked.get(w.warehouseId) ?? 0),
      }));
    }

    // Draft reserves nothing, so oversell there is only a warning. Held is
    // a real reservation, so it's a hard block instead.
    let stockWarning: string | undefined;
    if (product.stockTracked) {
      const storeAvailable = await getStoreWideAvailable(
        line.bill.storeId,
        line.productId,
        effectivePerWarehouse,
      );
      const resultingAvailable = storeAvailable + line.quantity - data.quantity;
      if (resultingAvailable < 0) {
        const message = `Only ${storeAvailable + line.quantity} of ${product.name} available across this store's warehouses.`;
        if (isHeld) return apiErrorResponse("bad_request", message, 400);
        stockWarning = message;
      }
    }

    const lineSubtotal = Number(product.price) * data.quantity - Number(line.discountApplied ?? 0);
    const tax = await resolveTax({
      productId: product.id,
      lineSubtotal,
      storeTaxEngineCode: line.bill.store.taxEngine?.code ?? null,
      storeStateId: line.bill.store.stateId,
      customerStateId: line.bill.customer?.stateId ?? null,
    });
    const lineTotal = lineSubtotal + tax.taxAmount;

    const allocResult = product.stockTracked
      ? await resolveAllocations({
          storeId: line.bill.storeId,
          productId: product.id,
          quantity: data.quantity,
          requested: data.allocations,
          perWarehouse: effectivePerWarehouse,
        })
      : { allocations: [] };
    if ("error" in allocResult) {
      if (isHeld) return apiErrorResponse("bad_request", allocResult.error, 400);
      stockWarning = allocResult.error;
    } else if (allocResult.fellBack) {
      stockWarning =
        "The chosen warehouse split was no longer available — reallocated automatically.";
    }
    const allocations = "error" in allocResult ? [] : allocResult.allocations;

    let reasonCodeId: string | null = null;
    if (isHeld && product.stockTracked) {
      const reasonCode = await db.reasonCode.findFirst({
        where: { category: "stock_block", label: "Reserved — pending bill" },
      });
      if (!reasonCode) {
        return apiErrorResponse(
          "bad_request",
          "Missing the 'Reserved — pending bill' reason code — contact a Super Admin.",
          400,
        );
      }
      reasonCodeId = reasonCode.id;
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.billLine.update({
        where: { id: lineId },
        data: {
          quantity: data.quantity,
          taxBreakdown: tax as never,
          lineTotal,
        },
      });

      if (product.stockTracked) {
        await replaceBillLineAllocations(tx, {
          billLineId: lineId,
          allocations,
        });
        if (isHeld) {
          await blockLineAllocations(tx, {
            billLineId: lineId,
            product,
            storeId: line.bill.storeId,
            financialYearId: line.bill.financialYearId,
            userId: session.user.id,
            reasonCodeId: reasonCodeId!,
          });
        }
      }

      const updatedBill = await recomputeBillTotals(tx, id);
      return { line: updated, bill: updatedBill };
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill_line",
      entityId: lineId,
      beforeData: line,
      afterData: result.line,
    });

    return Response.json({ ...result, warning: stockWarning });
  });
}

// Mid-bill line removal — voids rather than deletes so the trace stays
// (step5 §11).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id, lineId } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const loaded = await loadEditableLine(db, id, lineId, session.user.storeId);
    if ("error" in loaded) return loaded.error;
    const { line } = loaded;

    const result = await db.$transaction(async (tx) => {
      await releaseBillLineAllocations(tx, lineId, session.user.id);
      await tx.billLineWarehouseAllocation.deleteMany({ where: { billLineId: lineId } });
      const voided = await tx.billLine.update({
        where: { id: lineId },
        data: { status: "voided", voidedByUserId: session.user.id, voidedAt: new Date() },
      });
      const updatedBill = await recomputeBillTotals(tx, id);
      return { line: voided, bill: updatedBill };
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill_line",
      entityId: lineId,
      beforeData: line,
      afterData: result.line,
    });

    return Response.json(result);
  });
}
