import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";

// GET /v1/ecommerce/products/{product_id}: single-product detail — a real
// product page shouldn't have to fetch the whole catalog to render one item.
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

  const [product, preferences, warehouses] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        videos: true,
        systemBarcode: true,
        stockTracked: true,
        isActive: true,
        isDeleted: true,
        category: { select: { id: true, name: true } },
        hsnCode: { select: { hsnCode: true, cgstRate: true, sgstRate: true, igstRate: true } },
      },
    }),
    db.taxPreferences.findFirst(),
    db.warehouse.findMany({
      where: { storeId: { in: auth.storeIds }, isActive: true, isDeleted: false },
      select: { id: true },
    }),
  ]);
  if (!product || !product.isActive || product.isDeleted) {
    return apiErrorResponse("not_found", "Product not found.", 404);
  }

  let available = 0;
  if (product.stockTracked) {
    for (const warehouse of warehouses) {
      const levels = await getStockLevels({ productId, warehouseId: warehouse.id });
      available += levels.available;
    }
  }

  return Response.json({
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    images: product.images,
    videos: product.videos,
    systemBarcode: product.systemBarcode,
    categoryId: product.category?.id ?? null,
    categoryName: product.category?.name ?? null,
    available,
    tax:
      preferences?.hsnTaxDisplayEnabled && product.hsnCode
        ? {
            hsnCode: product.hsnCode.hsnCode,
            cgstRate: Number(product.hsnCode.cgstRate),
            sgstRate: Number(product.hsnCode.sgstRate),
            igstRate: Number(product.hsnCode.igstRate),
          }
        : null,
  });
}
