import {
  getPaymentGateway,
  isStubPaymentGatewayActive,
  stubPaymentDevControls,
} from "@/lib/adapters/payment";
import { reconcilePaymentRequestStatus } from "@/lib/billing/paymentRequests/reconcile";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Public, unauthenticated — the "Pay Now" action on the customer-facing pay
// page. Real gateway transactions are created lazily here, on first click.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const db = unscoped();
  const paymentRequest = await db.paymentRequest.findFirst({
    where: { OR: [{ gatewayReference: reference }, { id: reference }] },
    include: {
      bill: { include: { customer: true, store: { include: { currency: true } } } },
    },
  });
  if (!paymentRequest) {
    return apiErrorResponse("not_found", "This payment link is invalid.", 404);
  }
  if (paymentRequest.method === "card_machine") {
    return apiErrorResponse("bad_request", "This payment is confirmed at the counter.", 400);
  }
  if (paymentRequest.status !== "pending") {
    return apiErrorResponse(
      "bad_request",
      `This request is already ${paymentRequest.status}.`,
      400,
    );
  }

  if (isStubPaymentGatewayActive()) {
    stubPaymentDevControls.markPaid(paymentRequest.gatewayReference ?? reference);
    const updated = await reconcilePaymentRequestStatus(paymentRequest.id);
    return Response.json({ status: updated?.status ?? "paid" });
  }

  if (paymentRequest.gatewayReference) {
    const checkoutUrl = await getPaymentGateway().getCheckoutTarget(
      paymentRequest.gatewayReference,
    );
    return Response.json({ checkoutUrl });
  }

  const bill = paymentRequest.bill;
  const customerName = bill.customer?.name ?? bill.customerName ?? undefined;
  const customerEmail = bill.customer?.email ?? bill.customerEmail ?? undefined;
  const customerPhone = bill.customer?.phone ?? bill.customerPhone ?? undefined;

  const result = await getPaymentGateway().createRequest({
    documentNumber: paymentRequest.documentNumber,
    amount: Number(paymentRequest.amount),
    currency: bill.store.currency?.code ?? "INR",
    method: paymentRequest.method,
    customer: { name: customerName, email: customerEmail, phone: customerPhone },
  });

  await db.paymentRequest.update({
    where: { id: paymentRequest.id },
    data: { gatewayReference: result.gatewayReference },
  });

  return Response.json({ checkoutUrl: result.externalCheckoutUrl ?? result.presentationValue });
}
