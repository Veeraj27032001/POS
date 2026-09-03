import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { isStubPaymentGatewayActive, stubPaymentDevControls } from "@/lib/adapters/payment";
import { paymentRequestSimulateSchema } from "@/lib/billing/schemas";
import { reconcilePaymentRequestStatus } from "@/lib/billing/paymentRequests/reconcile";
import { unscoped } from "@/lib/db";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Dev/demo only — simulates the customer completing (or the request
// expiring) a QR/link payment, so the whole flow is testable with zero
// real payment gateway credentials. Gated server-side, unconditionally,
// before anything else: this route does not exist at all once a real
// gateway adapter is active.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStubPaymentGatewayActive()) {
    return apiErrorResponse("not_found", "Not found.", 404);
  }

  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, paymentRequestSimulateSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const existing = await unscoped().paymentRequest.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Payment request not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Payment request not found.", 404);
    }
    if (existing.method === "card_machine") {
      return apiErrorResponse(
        "bad_request",
        "Card machine requests are confirmed directly, not simulated.",
        400,
      );
    }
    if (!existing.gatewayReference) {
      return apiErrorResponse("bad_request", "This request has no gateway reference yet.", 400);
    }

    if (parsed.data.action === "markPaid") {
      stubPaymentDevControls.markPaid(existing.gatewayReference);
    } else {
      stubPaymentDevControls.markExpired(existing.gatewayReference);
    }

    const updated = await reconcilePaymentRequestStatus(id);
    return Response.json({
      id: updated?.id,
      status: updated?.status,
      paidAt: updated?.paidAt,
      gatewayReference: updated?.gatewayReference,
      devSimulateAvailable: true,
    });
  });
}
