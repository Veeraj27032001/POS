import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { reconcilePaymentRequestStatus } from "@/lib/billing/paymentRequests/reconcile";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;
  return withStoreContext(async () => {
    const existing = await unscoped().paymentRequest.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Payment request not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Payment request not found.", 404);
    }

    const updated = await reconcilePaymentRequestStatus(id);
    if (!updated) return apiErrorResponse("not_found", "Payment request not found.", 404);

    return Response.json({
      id: updated.id,
      status: updated.status,
      paidAt: updated.paidAt,
      gatewayReference: updated.gatewayReference,
    });
  });
}
