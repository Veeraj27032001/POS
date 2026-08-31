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
  const warehouseId = url.searchParams.get("warehouseId");
  if (!warehouseId) {
    return apiErrorResponse("bad_request", "warehouseId is required.", 400);
  }

  return withStoreContext(async () => {
    const warehouse = await unscoped().warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || (session.user.storeId && warehouse.storeId !== session.user.storeId)) {
      return apiErrorResponse("not_found", "Warehouse not found.", 404);
    }

    const products = await unscoped().product.findMany({
      where: { isActive: true, isDeleted: false, stockTracked: true, reorderLevel: { not: null } },
      select: { id: true, name: true, systemBarcode: true, reorderLevel: true },
      orderBy: { name: "asc" },
    });

    const data: {
      productId: string;
      productName: string;
      productBarcode: string;
      reorderLevel: number;
      available: number;
    }[] = [];
    for (const product of products) {
      const { available } = await getStockLevels({ productId: product.id, warehouseId });
      if (available <= product.reorderLevel!) {
        data.push({
          productId: product.id,
          productName: product.name,
          productBarcode: product.systemBarcode,
          reorderLevel: product.reorderLevel!,
          available,
        });
      }
    }

    return Response.json({ data });
  });
}
