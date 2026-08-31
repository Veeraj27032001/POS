import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

import type { BillLineAllocationInput } from "./allocateBillLineStock";

// There's no per-unit lot/batch tracking in this system — stock is
// aggregate per warehouse. The earliest date this product ever entered a
// given warehouse (via inward, opening, positive adjustment, or an
// accepted transfer-in) stands in for "how long this warehouse has been
// holding it," across the only sources that add to on-hand.
async function getOldestStockEntryDate(
  productId: string,
  warehouseId: string,
): Promise<Date | null> {
  const db = unscoped();
  const [inward, opening, positiveAdj, transferIn] = await Promise.all([
    db.stockInwardItem.findFirst({
      where: { productId, stockInwardMain: { warehouseId } },
      orderBy: { stockInwardMain: { inwardDate: "asc" } },
      select: { stockInwardMain: { select: { inwardDate: true } } },
    }),
    db.stockOpeningItem.findFirst({
      where: { productId, stockOpeningMain: { warehouseId } },
      orderBy: { stockOpeningMain: { openingDate: "asc" } },
      select: { stockOpeningMain: { select: { openingDate: true } } },
    }),
    db.stockPositiveAdjustmentItem.findFirst({
      where: { productId, stockPositiveAdjustmentMain: { warehouseId } },
      orderBy: { stockPositiveAdjustmentMain: { adjustmentDate: "asc" } },
      select: { stockPositiveAdjustmentMain: { select: { adjustmentDate: true } } },
    }),
    db.stockTransferItem.findFirst({
      where: {
        productId,
        destinationWarehouseId: warehouseId,
        stockTransferMain: { status: "accepted" },
      },
      orderBy: { stockTransferMain: { respondedAt: "asc" } },
      select: { stockTransferMain: { select: { respondedAt: true } } },
    }),
  ]);

  const dates = [
    inward?.stockInwardMain.inwardDate,
    opening?.stockOpeningMain.openingDate,
    positiveAdj?.stockPositiveAdjustmentMain.adjustmentDate,
    transferIn?.stockTransferMain.respondedAt,
  ].filter((d): d is Date => d != null);

  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

export type AutoAllocateResult = { allocations: BillLineAllocationInput[] } | { error: string };

// step5 §7.8's cashier-chooses-the-split is the manual path; this is the
// default when nothing's chosen. Tries each warehouse with stock, oldest
// entry first, for one that alone covers the full quantity (so a line
// doesn't get split just because the very oldest warehouse is short) —
// only falls back to filling across several, oldest-first, once no single
// one can cover it alone.
export async function autoAllocateWarehouses(params: {
  storeId: string;
  productId: string;
  quantity: number;
}): Promise<AutoAllocateResult> {
  const db = unscoped();
  const warehouses = await db.warehouse.findMany({
    where: { storeId: params.storeId, isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (warehouses.length === 0) {
    return { error: "This store has no active warehouse to allocate stock from." };
  }

  const candidates: { warehouseId: string; available: number; oldestEntryDate: number }[] = [];
  for (const warehouse of warehouses) {
    const { available } = await getStockLevels({
      productId: params.productId,
      warehouseId: warehouse.id,
    });
    if (available <= 0) continue;
    const oldestEntryDate = await getOldestStockEntryDate(params.productId, warehouse.id);
    candidates.push({
      warehouseId: warehouse.id,
      available,
      oldestEntryDate: oldestEntryDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
    });
  }

  candidates.sort((a, b) => a.oldestEntryDate - b.oldestEntryDate);

  const singleCoverage = candidates.find((c) => c.available >= params.quantity);
  if (singleCoverage) {
    return {
      allocations: [{ warehouseId: singleCoverage.warehouseId, quantity: params.quantity }],
    };
  }

  let remaining = params.quantity;
  const allocations: BillLineAllocationInput[] = [];
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(candidate.available, remaining);
    allocations.push({ warehouseId: candidate.warehouseId, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    return { error: "Not enough stock across this store's warehouses to cover this quantity." };
  }
  return { allocations };
}
