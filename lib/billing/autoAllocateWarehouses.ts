import { unscoped } from "@/lib/db";

import type { BillLineAllocationInput } from "./allocateBillLineStock";
import { getWarehouseAvailability, type WarehouseAvailability } from "./getWarehouseAvailability";

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
// one can cover it alone. Pass an already-computed `perWarehouse` list to
// skip re-querying availability that's already been looked up.
export async function autoAllocateWarehouses(params: {
  storeId: string;
  productId: string;
  quantity: number;
  perWarehouse?: WarehouseAvailability[];
}): Promise<AutoAllocateResult> {
  const levels =
    params.perWarehouse ?? (await getWarehouseAvailability(params.storeId, params.productId));
  if (levels.length === 0) {
    return { error: "This store has no active storage location to allocate stock from." };
  }

  const withStock = levels.filter((l) => l.available > 0);
  const candidates = await Promise.all(
    withStock.map(async (level) => {
      const oldestEntryDate = await getOldestStockEntryDate(params.productId, level.warehouseId);
      return {
        warehouseId: level.warehouseId,
        available: level.available,
        oldestEntryDate: oldestEntryDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    }),
  );

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
    return { error: "Not enough stock in this store's storage to cover this quantity." };
  }
  return { allocations };
}
