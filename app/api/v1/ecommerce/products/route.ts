import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";

// step7 §5 — GET /v1/ecommerce/products: catalog feed for the merchant's own
// e-commerce site, with live available stock summed across the store's
// warehouses (same /lib/stock figure the rest of the app reads).
export async function GET(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 50)));
  const search = url.searchParams.get("search")?.trim() || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;

  const db = unscoped();
  const [preferences, warehouses] = await Promise.all([
    db.taxPreferences.findFirst(),
    db.warehouse.findMany({
      where: { storeId: { in: auth.storeIds }, isActive: true, isDeleted: false },
      select: { id: true },
    }),
  ]);
  const showTax = preferences?.hsnTaxDisplayEnabled ?? false;

  const where = {
    isActive: true,
    isDeleted: false,
    stockTracked: true,
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { systemBarcode: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [totalRecords, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        systemBarcode: true,
        category: { select: { name: true } },
        hsnCode: { select: { hsnCode: true, cgstRate: true, sgstRate: true, igstRate: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const data = [];
  for (const product of products) {
    let available = 0;
    for (const warehouse of warehouses) {
      const levels = await getStockLevels({ productId: product.id, warehouseId: warehouse.id });
      available += levels.available;
    }
    data.push({
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      images: product.images,
      systemBarcode: product.systemBarcode,
      categoryName: product.category?.name ?? null,
      available,
      tax:
        showTax && product.hsnCode
          ? {
              hsnCode: product.hsnCode.hsnCode,
              cgstRate: Number(product.hsnCode.cgstRate),
              sgstRate: Number(product.hsnCode.sgstRate),
              igstRate: Number(product.hsnCode.igstRate),
            }
          : null,
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  return Response.json({ totalRecords, totalPages, page, pageSize, data });
}
