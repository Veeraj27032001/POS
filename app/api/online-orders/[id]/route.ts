import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view online orders.", 403);
  }

  const { id } = await params;
  return withStoreContext(async () => {
    const db = unscoped();
    const order = await db.ecommerceOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            locks: {
              include: {
                store: { select: { name: true } },
                warehouse: { select: { name: true } },
              },
            },
          },
        },
        payments: true,
        bill: { select: { id: true, documentNumber: true, grandTotal: true } },
        respondedByUser: { select: { name: true } },
      },
    });
    if (!order) return apiErrorResponse("not_found", "Online order not found.", 404);
    if (session.user.storeId && order.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Online order not found.", 404);
    }
    return Response.json(order);
  });
}
