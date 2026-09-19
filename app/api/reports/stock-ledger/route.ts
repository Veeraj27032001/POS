import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { getStockLedger } from "@/lib/reports/getStockLedger";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "reports", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view reports.", 403);
  }

  const url = new URL(request.url);
  const financialYearId = url.searchParams.get("financialYearId") || undefined;
  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const productId = url.searchParams.get("productId") || undefined;

  if (!financialYearId || !warehouseId || !productId) {
    return apiErrorResponse(
      "bad_request",
      "Financial year, storage location and product are all required.",
      400,
    );
  }

  return withStoreContext(async () => {
    const db = unscoped();

    const financialYear = await db.financialYear.findUnique({ where: { id: financialYearId } });
    if (!financialYear) {
      return apiErrorResponse("not_found", "Financial year not found.", 404);
    }

    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return apiErrorResponse("not_found", "Storage location not found.", 404);
    }
    if (session.user.storeId && warehouse.storeId !== session.user.storeId) {
      return apiErrorResponse("forbidden", "That storage location belongs to another store.", 403);
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return apiErrorResponse("not_found", "Product not found.", 404);
    }

    const ledger = await getStockLedger({
      productId,
      warehouseId,
      fyStart: financialYear.startDate,
      fyEnd: financialYear.endDate,
    });

    return Response.json({
      financialYearLabel: financialYear.label,
      warehouseName: warehouse.name,
      productName: product.name,
      ...ledger,
    });
  });
}
