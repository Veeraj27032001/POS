import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { loadEditableLine } from "@/lib/billing/loadEditableLine";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveTax } from "@/lib/billing/resolveTax";
import { billLineDiscountSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Applies a discount to one line — the reason code is optional.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "discounts", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to apply discounts.", 403);
  }

  const { id, lineId } = await params;
  const parsed = await parseJsonOrRespond(request, billLineDiscountSchema);
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

    const rawSubtotal = Number(product.price) * line.quantity;
    if (data.discountApplied > rawSubtotal) {
      return apiErrorResponse(
        "bad_request",
        `Discount can't exceed the line's subtotal of ${rawSubtotal}.`,
        400,
      );
    }

    const lineSubtotal = rawSubtotal - data.discountApplied;
    const tax = await resolveTax({
      productId: product.id,
      lineSubtotal,
      storeTaxEngineCode: line.bill.store.taxEngine?.code ?? null,
      storeStateId: line.bill.store.stateId,
      customerStateId: line.bill.customer?.stateId ?? null,
    });
    const lineTotal = lineSubtotal + tax.taxAmount;

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.billLine.update({
        where: { id: lineId },
        data: {
          discountApplied: data.discountApplied,
          discountReasonCodeId: data.discountReasonCodeId ?? null,
          taxBreakdown: tax as never,
          lineTotal,
        },
      });
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
  });
}
