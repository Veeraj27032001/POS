import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

interface InventoryValuationRow {
  productId: string;
  productName: string;
  systemBarcode: string;
  categoryName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  onHand: number;
  unitCost: number;
  value: number;
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
      return apiErrorResponse("not_found", "Storage location not found.", 404);
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
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        systemBarcode: true,
        defaultCostPrice: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const allRows: InventoryValuationRow[] = [];
    for (const product of products) {
      const unitCost = Number(product.defaultCostPrice ?? 0);
      let productOnHand = 0;
      for (const warehouse of warehouses) {
        const { onHand } = await getStockLevels({
          productId: product.id,
          warehouseId: warehouse.id,
        });
        if (groupByWarehouse) {
          allRows.push({
            productId: product.id,
            productName: product.name,
            systemBarcode: product.systemBarcode,
            categoryName: product.category?.name ?? null,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            onHand,
            unitCost,
            value: Math.round(onHand * unitCost * 100) / 100,
          });
        } else {
          productOnHand += onHand;
        }
      }
      if (!groupByWarehouse) {
        allRows.push({
          productId: product.id,
          productName: product.name,
          systemBarcode: product.systemBarcode,
          categoryName: product.category?.name ?? null,
          warehouseId: null,
          warehouseName: null,
          onHand: productOnHand,
          unitCost,
          value: Math.round(productOnHand * unitCost * 100) / 100,
        });
      }
    }

    const totalRecords = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const data = countOnly
      ? []
      : allRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
    const totalValue = Math.round(allRows.reduce((sum, row) => sum + row.value, 0) * 100) / 100;

    return Response.json({
      totalRecords,
      totalPages,
      page: clampedPage,
      pageSize,
      data,
      totalValue,
    });
  });
}
