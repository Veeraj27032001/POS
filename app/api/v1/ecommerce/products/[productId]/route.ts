import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import {
  getProductAvailability,
  type StoreWithWarehouses,
} from "@/lib/ecommerce/getProductAvailability";
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

  const [product, preferences, warehouses, stores] = await Promise.all([
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
      select: { id: true, storeId: true },
    }),
    db.store.findMany({ where: { id: { in: auth.storeIds } }, select: { id: true, name: true } }),
  ]);
  if (!product || !product.isActive || product.isDeleted) {
    return apiErrorResponse("not_found", "Product not found.", 404);
  }

  const storesWithWarehouses: StoreWithWarehouses[] = stores.map((store) => ({
    storeId: store.id,
    storeName: store.name,
    warehouseIds: warehouses.filter((w) => w.storeId === store.id).map((w) => w.id),
  }));

  let available = 0;
  let stockByStore: Awaited<ReturnType<typeof getProductAvailability>>["stockByStore"] = [];
  if (product.stockTracked) {
    ({ available, stockByStore } = await getProductAvailability(productId, storesWithWarehouses));
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
    stockByStore,
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
