import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { billDiscountSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// A discount on the bill's total — separate from, and applied on top of,
// any per-line discounts (lib/billing/schemas.ts's billLineDiscountSchema).
// The reason code is optional.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "discounts", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to apply discounts.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billDiscountSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id }, include: { lines: true } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft" && bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't update a ${bill.status} bill.`, 400);
    }

    const activeLines = bill.lines.filter((l) => l.status === "active");
    const subtotal = activeLines.reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0);
    const lineDiscountTotal = activeLines.reduce(
      (sum, l) => sum + Number(l.discountApplied ?? 0),
      0,
    );
    const maxDiscount = Math.max(0, subtotal - lineDiscountTotal);
    if (data.overallDiscount > maxDiscount) {
      return apiErrorResponse(
        "bad_request",
        `Discount can't exceed ${maxDiscount.toFixed(2)} (the bill's subtotal after line discounts).`,
        400,
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: {
          overallDiscount: data.overallDiscount,
          discountReasonCodeId: data.discountReasonCodeId ?? null,
        },
      });
      return recomputeBillTotals(tx, id);
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill",
      entityId: id,
      beforeData: bill,
      afterData: result,
    });

    return Response.json(result);
  });
}
