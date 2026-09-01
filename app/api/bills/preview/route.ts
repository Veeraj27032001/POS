import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  applySelfBlocked,
  getSelfBlockedByWarehouse,
} from "@/lib/billing/getSelfBlockedByWarehouse";
import { getWarehouseAvailability } from "@/lib/billing/getWarehouseAvailability";
import { billPreviewSchema } from "@/lib/billing/schemas";
import { resolveAllocations } from "@/lib/billing/resolveAllocations";
import { resolveTax } from "@/lib/billing/resolveTax";
import { unscoped } from "@/lib/db";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Computes what a bill's totals (subtotal, discount, real GST tax, grand
// total) would be for a cart that only exists in the browser so far —
// nothing here is persisted. Lets the cashier see an accurate amount to
// collect before anything is actually saved (Draft/Hold/Create bill).
export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }
  if (!session.user.storeId) {
    return apiErrorResponse(
      "forbidden",
      "A Super Admin session has no single store — sign in as a store user to bill.",
      403,
    );
  }

  const parsed = await parseJsonOrRespond(request, billPreviewSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const store = await db.store.findUnique({
      where: { id: session.user.storeId! },
      include: { taxEngine: true },
    });
    if (!store) return apiErrorResponse("not_found", "Store not found.", 404);

    const products = await db.product.findMany({
      where: { id: { in: data.lines.map((l) => l.productId) } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let lineDiscountTotal = 0;
    let taxTotal = 0;
    const lines: {
      productId: string;
      productName: string;
      unitPrice: number;
      lineSubtotal: number;
      discountApplied: number;
      tax: Awaited<ReturnType<typeof resolveTax>>;
      lineTotal: number;
      allocations: { warehouseId: string; quantity: number }[];
      allocationWarning: string | null;
      warehouseAvailability: { warehouseId: string; available: number }[];
    }[] = [];
    const warehouseIds = new Set<string>();

    for (const line of data.lines) {
      const product = productById.get(line.productId);
      if (!product || !product.isActive || product.isDeleted) {
        return apiErrorResponse("bad_request", "Product not found or inactive.", 400);
      }
      const unitPrice = Number(product.price);
      const lineSubtotal = unitPrice * line.quantity;
      const tax = await resolveTax({
        productId: product.id,
        lineSubtotal,
        storeTaxEngineCode: store.taxEngine?.code ?? null,
        storeStateId: store.stateId,
        customerStateId: data.customerStateId ?? null,
        excludeTax: data.excludeTax,
      });
      const lineTotal = lineSubtotal - line.discountApplied + tax.taxAmount;

      let allocations: { warehouseId: string; quantity: number }[] = [];
      let allocationWarning: string | null = null;
      let warehouseAvailability: { warehouseId: string; available: number }[] = [];
      if (product.stockTracked) {
        const perWarehouse = await getWarehouseAvailability(session.user.storeId!, product.id);
        const effectivePerWarehouse = data.billId
          ? applySelfBlocked(perWarehouse, await getSelfBlockedByWarehouse(data.billId, product.id))
          : perWarehouse;
        warehouseAvailability = effectivePerWarehouse;
        const allocResult = await resolveAllocations({
          storeId: session.user.storeId!,
          productId: product.id,
          quantity: line.quantity,
          requested: line.allocations,
          perWarehouse: effectivePerWarehouse,
        });
        if ("error" in allocResult) {
          allocationWarning = allocResult.error;
        } else {
          allocations = allocResult.allocations;
          if (allocResult.fellBack) {
            allocationWarning =
              "The chosen warehouse split no longer has enough stock — showing an automatic reallocation instead.";
          }
        }
        for (const w of perWarehouse) warehouseIds.add(w.warehouseId);
      }

      subtotal += lineSubtotal;
      lineDiscountTotal += line.discountApplied;
      taxTotal += tax.taxAmount;
      lines.push({
        productId: product.id,
        productName: product.name,
        unitPrice,
        lineSubtotal: round2(lineSubtotal),
        discountApplied: line.discountApplied,
        tax,
        lineTotal: round2(lineTotal),
        allocations,
        allocationWarning,
        warehouseAvailability,
      });
    }

    const warehouses = await db.warehouse.findMany({
      where: { id: { in: Array.from(warehouseIds) } },
      select: { id: true, name: true },
    });
    const warehouseNameById = new Map(warehouses.map((w) => [w.id, w.name]));

    const discountTotal = lineDiscountTotal + data.overallDiscount;
    const grandTotal = subtotal - discountTotal + taxTotal;

    return Response.json({
      lines: lines.map((line) => ({
        ...line,
        allocations: line.allocations.map((a) => ({
          ...a,
          warehouseName: warehouseNameById.get(a.warehouseId) ?? "",
        })),
        warehouseAvailability: line.warehouseAvailability.map((w) => ({
          ...w,
          warehouseName: warehouseNameById.get(w.warehouseId) ?? "",
        })),
      })),
      subtotal: round2(subtotal),
      lineDiscountTotal: round2(lineDiscountTotal),
      overallDiscount: round2(data.overallDiscount),
      discountTotal: round2(discountTotal),
      taxTotal: round2(taxTotal),
      grandTotal: round2(grandTotal),
    });
  });
}
