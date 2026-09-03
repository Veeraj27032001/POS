import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

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
    if (existing.status !== "pending") {
      return Response.json(existing);
    }

    const updated = await db.paymentRequest.updateMany({
      where: { id, status: "pending" },
      data: { status: "cancelled" },
    });
    const result =
      updated.count > 0 ? await db.paymentRequest.findUniqueOrThrow({ where: { id } }) : existing;

    if (updated.count > 0) {
      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "update",
        entityType: "payment_request",
        entityId: id,
        beforeData: existing,
        afterData: result,
      });
    }

    return Response.json(result);
  });
}
