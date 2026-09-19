import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view stock.", 403);
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const warehouseId = url.searchParams.get("warehouseId");
  if (!productId || !warehouseId) {
    return apiErrorResponse("bad_request", "productId and warehouseId are required.", 400);
  }

  return withStoreContext(async () => {
    const warehouse = await unscoped().warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || (session.user.storeId && warehouse.storeId !== session.user.storeId)) {
      return apiErrorResponse("not_found", "Storage location not found.", 404);
    }

    const levels = await getStockLevels({ productId, warehouseId });
    return Response.json(levels);
  });
}
