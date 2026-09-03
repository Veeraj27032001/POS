import type { Prisma } from "@/generated/prisma/client";
import { getPaymentGateway } from "@/lib/adapters/payment";
import { recordBillPayment } from "@/lib/billing/recordBillPayment";
import { unscoped } from "@/lib/db";

import { resolveGatewayPaymentMethod } from "./resolveGatewayPaymentMethod";

// The single place a Payment Request transitions to `paid`.
export async function reconcilePaymentRequestStatus(paymentRequestId: string) {
  const db = unscoped();
  const request = await db.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: { bill: true },
  });
  if (!request) return null;

  if (request.status !== "pending") return request;
  // card_machine only resolves via the /confirm route, never polling.
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
    // Atomic compare-and-swap so concurrent polls can't double-post.
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
        referenceNumber: statusResult.transactionId ?? request.gatewayReference,
        financialYearId: request.financialYearId,
        gatewayResponse: statusResult.transactionDetails as Prisma.InputJsonValue | undefined,
      },
      tx,
    );

    return tx.paymentRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}
