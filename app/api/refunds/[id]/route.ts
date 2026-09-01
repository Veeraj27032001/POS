import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
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
    const db = unscoped();
    const refund = await db.refund.findUnique({
      where: { id },
      include: {
        refundMethod: { select: { name: true } },
        processedByUser: { select: { name: true } },
      },
    });
    if (!refund) return apiErrorResponse("not_found", "Refund not found.", 404);
    if (session.user.storeId && refund.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Refund not found.", 404);
    }

    const source =
      refund.sourceType === "bill_return"
        ? await db.billReturn.findUnique({
            where: { id: refund.sourceId },
            select: {
              id: true,
              documentNumber: true,
              bill: { select: { id: true, documentNumber: true } },
            },
          })
        : await db.billCancellation.findUnique({
            where: { id: refund.sourceId },
            select: {
              id: true,
              documentNumber: true,
              bill: { select: { id: true, documentNumber: true } },
            },
          });

    return Response.json({ ...refund, source });
  });
}
