import { getPaymentGateway } from "@/lib/adapters/payment";
import { recordBillPayment } from "@/lib/billing/recordBillPayment";
import { unscoped } from "@/lib/db";

import { resolveGatewayPaymentMethod } from "./resolveGatewayPaymentMethod";

// The single place a Payment Request transitions to `paid` and its
// resulting BillPayment gets created — called both by the status-poll
// route and by the dev-simulate route, so the transition logic never
// exists in two places.
export async function reconcilePaymentRequestStatus(paymentRequestId: string) {
  const db = unscoped();
  const request = await db.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: { bill: true },
  });
  if (!request) return null;

  if (request.status !== "pending") return request;
  // card_machine is confirmed by an explicit staff action (see the
  // /confirm route) — it never resolves through gateway polling.
  if (request.method === "card_machine") return request;

  const statusResult = await getPaymentGateway().checkStatus(request.gatewayReference ?? "");

  if (statusResult.status === "expired") {
    return db.paymentRequest.update({ where: { id: request.id }, data: { status: "expired" } });
  }
  if (statusResult.status !== "paid") {
    return request;
  }

  return unscoped().$transaction(async (tx) => {
    const paidAt = statusResult.paidAt ?? new Date();
    // Atomic compare-and-swap: only the poll/call that actually wins this
    // update goes on to create the BillPayment, so concurrent polls (two
    // tabs, or a poll racing the dev-simulate action) can't double-post.
    const claimed = await tx.paymentRequest.updateMany({
      where: { id: request.id, status: "pending" },
      data: { status: "paid", paidAt },
    });
    if (claimed.count === 0) {
      return tx.paymentRequest.findUniqueOrThrow({ where: { id: request.id } });
    }

    const paymentMethodId = await resolveGatewayPaymentMethod(tx, request.method);
    await recordBillPayment(
      {
        billId: request.billId,
        paymentMethodId,
        amount: Number(request.amount),
        referenceNumber: request.gatewayReference,
        financialYearId: request.financialYearId,
      },
      tx,
    );

    return tx.paymentRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}
