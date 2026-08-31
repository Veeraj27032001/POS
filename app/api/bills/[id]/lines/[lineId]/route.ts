import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  releaseBillLineAllocations,
  replaceBillLineAllocations,
} from "@/lib/billing/allocateBillLineStock";
import { getStoreWideAvailable } from "@/lib/billing/getStoreWideAvailable";
import { loadEditableLine } from "@/lib/billing/loadEditableLine";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveAllocations } from "@/lib/billing/resolveAllocations";
import { resolveTax } from "@/lib/billing/resolveTax";
import { billLineQuantitySchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

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

    if (product.stockTracked) {
      const storeAvailable = await getStoreWideAvailable(line.bill.storeId, line.productId);
      const resultingAvailable = storeAvailable + line.quantity - data.quantity;
      if (resultingAvailable < 0) {
        return apiErrorResponse(
          "bad_request",
          `Only ${storeAvailable + line.quantity} of ${product.name} available across this store's warehouses.`,
          400,
        );
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

    try {
      const result = await db.$transaction(async (tx) => {
        const allocResult = product.stockTracked
          ? await resolveAllocations(tx, {
              storeId: line.bill.storeId,
              quantity: data.quantity,
              requested: data.allocations,
            })
          : { allocations: [] };
        if ("error" in allocResult) throw new ValidationError(allocResult.error);

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
            product,
            storeId: line.bill.storeId,
            financialYearId: line.bill.financialYearId,
            userId: session.user.id,
            allocations: allocResult.allocations,
          });
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

      return Response.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return apiErrorResponse("bad_request", error.message, 400);
      }
      throw error;
    }
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
