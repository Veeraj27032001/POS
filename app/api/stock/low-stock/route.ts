import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

interface LowStockRow {
  productId: string;
  productName: string;
  productBarcode: string;
  reorderLevel: number;
  available: number;
}

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view stock.", 403);
  }

  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouseId");
  if (!warehouseId) {
    return apiErrorResponse("bad_request", "warehouseId is required.", 400);
  }
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const search = url.searchParams.get("search")?.trim() || undefined;
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const warehouse = await unscoped().warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || (session.user.storeId && warehouse.storeId !== session.user.storeId)) {
      return apiErrorResponse("not_found", "Storage location not found.", 404);
    }

    const products = await unscoped().product.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        stockTracked: true,
        reorderLevel: { not: null },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { systemBarcode: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, systemBarcode: true, reorderLevel: true },
      orderBy: { name: "asc" },
    });

    // "Low stock" is a computed condition (available <= reorderLevel), not a
    // stored column, so it can't be filtered/paginated at the DB level —
    // every candidate product's stock is computed first, then the matching
    // set is paginated in memory.
    const allLow: LowStockRow[] = [];
    for (const product of products) {
      const { available } = await getStockLevels({ productId: product.id, warehouseId });
      if (available <= product.reorderLevel!) {
        allLow.push({
          productId: product.id,
          productName: product.name,
          productBarcode: product.systemBarcode,
          reorderLevel: product.reorderLevel!,
          available,
        });
      }
    }

    const totalRecords = allLow.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const data = countOnly
      ? []
      : allLow.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return Response.json({ totalRecords, totalPages, page: clampedPage, pageSize, data });
  });
}
