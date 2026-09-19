import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

interface SalesReportRow {
  productId: string;
  productName: string;
  systemBarcode: string;
  skuBarcode: string | null;
  categoryName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  quantitySold: number;
  revenue: number;
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
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const db = unscoped();
    const effectiveStoreId = session.user.storeId ?? storeId;
    if (!effectiveStoreId) {
      return apiErrorResponse("bad_request", "Select a store first.", 400);
    }

    if (warehouseId) {
      const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse || warehouse.storeId !== effectiveStoreId) {
        return apiErrorResponse("not_found", "Storage location not found.", 404);
      }
    }

    const billDateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) billDateFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) billDateFilter.lte = new Date(`${dateTo}T23:59:59.999Z`);

    const lineWhere = {
      status: "active" as const,
      bill: {
        storeId: effectiveStoreId,
        status: "completed" as const,
        ...(dateFrom || dateTo ? { billDate: billDateFilter } : {}),
      },
      product: {
        isActive: true,
        isDeleted: false,
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
    };

    let allRows: SalesReportRow[];

    if (!groupByWarehouse) {
      const grouped = await db.billLine.groupBy({
        by: ["productId"],
        where: lineWhere,
        _sum: { quantity: true, lineTotal: true },
      });
      const products = await db.product.findMany({
        where: { id: { in: grouped.map((g) => g.productId) } },
        select: {
          id: true,
          name: true,
          systemBarcode: true,
          skuBarcode: true,
          category: { select: { name: true } },
        },
      });
      const productById = new Map(products.map((p) => [p.id, p]));
      allRows = grouped
        .map((g) => {
          const product = productById.get(g.productId);
          return {
            productId: g.productId,
            productName: product?.name ?? "—",
            systemBarcode: product?.systemBarcode ?? "",
            skuBarcode: product?.skuBarcode ?? null,
            categoryName: product?.category?.name ?? null,
            warehouseId: null,
            warehouseName: null,
            quantitySold: g._sum.quantity ?? 0,
            revenue: Number(g._sum.lineTotal ?? 0),
          };
        })
        .sort((a, b) => a.productName.localeCompare(b.productName));
    } else {
      // Revenue isn't stored per warehouse — only the line's own total is —
      // so each allocation's share of the line is prorated by its quantity
      // fraction of the line's total quantity.
      const allocations = await db.billLineWarehouseAllocation.findMany({
        where: {
          ...(warehouseId ? { warehouseId } : { warehouse: { storeId: effectiveStoreId } }),
          billLine: lineWhere,
        },
        include: {
          warehouse: { select: { id: true, name: true } },
          billLine: {
            select: {
              productId: true,
              quantity: true,
              lineTotal: true,
              product: {
                select: {
                  name: true,
                  systemBarcode: true,
                  skuBarcode: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      const byKey = new Map<string, SalesReportRow>();
      for (const allocation of allocations) {
        const line = allocation.billLine;
        const key = `${line.productId}:${allocation.warehouseId}`;
        const share = line.quantity > 0 ? allocation.quantity / line.quantity : 0;
        const revenueShare = Number(line.lineTotal) * share;
        const existing = byKey.get(key);
        if (existing) {
          existing.quantitySold += allocation.quantity;
          existing.revenue += revenueShare;
        } else {
          byKey.set(key, {
            productId: line.productId,
            productName: line.product.name,
            systemBarcode: line.product.systemBarcode,
            skuBarcode: line.product.skuBarcode,
            categoryName: line.product.category?.name ?? null,
            warehouseId: allocation.warehouseId,
            warehouseName: allocation.warehouse.name,
            quantitySold: allocation.quantity,
            revenue: revenueShare,
          });
        }
      }
      allRows = [...byKey.values()].sort(
        (a, b) =>
          a.productName.localeCompare(b.productName) ||
          a.warehouseName!.localeCompare(b.warehouseName!),
      );
    }

    allRows = allRows.map((row) => ({ ...row, revenue: Math.round(row.revenue * 100) / 100 }));

    const totalRecords = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const data = countOnly
      ? []
      : allRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return Response.json({ totalRecords, totalPages, page: clampedPage, pageSize, data });
  });
}
