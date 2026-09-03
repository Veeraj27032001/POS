import { isStubPaymentGatewayActive, stubPaymentDevControls } from "@/lib/adapters/payment";
import { reconcilePaymentRequestStatus } from "@/lib/billing/paymentRequests/reconcile";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Public, unauthenticated — the "Pay Now" action on the customer-facing pay
// page. Only ever does anything while the stub gateway is active: a real
// gateway (Razorpay) would never generate a link that points here at all —
// its own hosted checkout page collects the payment and confirms it via a
// webhook/poll instead — so this route staying stub-only is by construction,
// not a workaround, and 404s outright otherwise.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  if (!isStubPaymentGatewayActive()) {
    return apiErrorResponse("not_found", "Not found.", 404);
  }

  const { reference } = await params;
  const paymentRequest = await unscoped().paymentRequest.findFirst({
    where: { gatewayReference: reference },
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

  stubPaymentDevControls.markPaid(reference);
  const updated = await reconcilePaymentRequestStatus(paymentRequest.id);

  return Response.json({ status: updated?.status ?? "paid" });
}
