import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { recordBillPayment } from "@/lib/billing/recordBillPayment";
import { resolveGatewayPaymentMethod } from "@/lib/billing/paymentRequests/resolveGatewayPaymentMethod";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// The card_machine "staff confirms the terminal beeped success" action —
// there's no gateway signal for a physical card machine in this phase, so
// this is the only way that method's payment request ever reaches `paid`.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;
  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.paymentRequest.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Payment request not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Payment request not found.", 404);
    }
    if (existing.method !== "card_machine") {
      return apiErrorResponse("bad_request", "This isn't a card machine payment request.", 400);
    }
    if (existing.status !== "pending") {
      return apiErrorResponse("bad_request", `This request is already ${existing.status}.`, 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const claimed = await tx.paymentRequest.updateMany({
        where: { id, status: "pending" },
        data: { status: "paid", paidAt: new Date() },
      });
      if (claimed.count === 0) {
        return tx.paymentRequest.findUniqueOrThrow({ where: { id } });
      }

      const paymentMethodId = await resolveGatewayPaymentMethod(tx, "card_machine");
      await recordBillPayment(
        {
          billId: existing.billId,
          paymentMethodId,
          amount: Number(existing.amount),
          referenceNumber: existing.gatewayReference,
          financialYearId: existing.financialYearId,
        },
        tx,
      );

      return tx.paymentRequest.findUniqueOrThrow({ where: { id } });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "payment_request",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
