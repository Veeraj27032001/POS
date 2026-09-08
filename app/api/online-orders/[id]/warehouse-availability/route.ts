import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import {
  getCrossStoreWarehouseAvailability,
  type CrossStoreWarehouseAvailability,
} from "@/lib/ecommerce/getCrossStoreWarehouseAvailability";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Feeds the Generate Bill page's per-line source picker: for each product
// on the order, every active warehouse system-wide and how much of it is
// available — with this order's own currently-locked quantity added back
// in per warehouse, so keeping the default split never shows a false
// "0 available" (that stock is already this order's own reservation, not
// something it's competing with itself for).
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
      include: { items: { include: { locks: true } } },
    });
    if (!order) return apiErrorResponse("not_found", "Online order not found.", 404);
    if (session.user.storeId && order.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Online order not found.", 404);
    }

    const productIds = [...new Set(order.items.map((i) => i.productId))];
    const byProduct: Record<string, CrossStoreWarehouseAvailability[]> = {};

    for (const productId of productIds) {
      const raw = await getCrossStoreWarehouseAvailability(productId);
      const item = order.items.find((i) => i.productId === productId)!;
      byProduct[productId] = raw.map((w) => {
        const lockedHere = item.locks
          .filter((l) => l.warehouseId === w.warehouseId)
          .reduce((sum, l) => sum + l.quantity, 0);
        return { ...w, available: w.available + lockedHere };
      });
    }

    return Response.json(byProduct);
  });
}
