import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

interface StockReportRow {
  productId: string;
  productName: string;
  systemBarcode: string;
  skuBarcode: string | null;
  categoryName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  onHand: number;
  available: number;
}

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "reports", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view reports.", 403);
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || undefined;
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const groupByWarehouse = url.searchParams.get("groupByWarehouse") !== "0";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const db = unscoped();

    // The caller's own session store always wins over the query param — a
    // store-scoped Admin can't widen their view by passing a different
    // storeId. Only a cross-store (Super Admin) session relies on the query
    // param at all.
    const effectiveStoreId = session.user.storeId ?? storeId;

    const warehouses = await db.warehouse.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        ...(warehouseId ? { id: warehouseId } : {}),
        ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (warehouseId && warehouses.length === 0) {
      return apiErrorResponse("not_found", "Warehouse not found.", 404);
    }

    const products = await db.product.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        stockTracked: true,
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { systemBarcode: { contains: search, mode: "insensitive" as const } },
                { skuBarcode: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        systemBarcode: true,
        skuBarcode: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Every product × warehouse combination has its own stock, so the report
    // is genuinely that many rows — computed here, then paginated in memory,
    // the same shape the Low Stock report already established. When not
    // grouping by warehouse, the per-warehouse figures are summed into one
    // row per product instead.
    const allRows: StockReportRow[] = [];
    for (const product of products) {
      let productOnHand = 0;
      let productAvailable = 0;
      for (const warehouse of warehouses) {
        const { onHand, available } = await getStockLevels({
          productId: product.id,
          warehouseId: warehouse.id,
        });
        if (groupByWarehouse) {
          allRows.push({
            productId: product.id,
            productName: product.name,
            systemBarcode: product.systemBarcode,
            skuBarcode: product.skuBarcode,
            categoryName: product.category?.name ?? null,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            onHand,
            available,
          });
        } else {
          productOnHand += onHand;
          productAvailable += available;
        }
      }
      if (!groupByWarehouse) {
        allRows.push({
          productId: product.id,
          productName: product.name,
          systemBarcode: product.systemBarcode,
          skuBarcode: product.skuBarcode,
          categoryName: product.category?.name ?? null,
          warehouseId: null,
          warehouseName: null,
          onHand: productOnHand,
          available: productAvailable,
        });
      }
    }

    const totalRecords = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const data = countOnly
      ? []
      : allRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return Response.json({ totalRecords, totalPages, page: clampedPage, pageSize, data });
  });
}
