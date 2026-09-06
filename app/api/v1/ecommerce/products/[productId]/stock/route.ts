import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";

// step7 §5 — GET /v1/ecommerce/products/{product_id}/stock: real-time stock
// check for one product, summed across the store's warehouses.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const { productId } = await params;
  const db = unscoped();

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive || product.isDeleted) {
    return apiErrorResponse("not_found", "Product not found.", 404);
  }

  const warehouses = await db.warehouse.findMany({
    where: { storeId: { in: auth.storeIds }, isActive: true, isDeleted: false },
    select: { id: true },
  });

  let available = 0;
  for (const warehouse of warehouses) {
    const levels = await getStockLevels({ productId, warehouseId: warehouse.id });
    available += levels.available;
  }

  return Response.json({ productId, available });
}
