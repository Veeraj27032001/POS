import { unscoped } from "@/lib/db";

import type { BillLineAllocationInput } from "./allocateBillLineStock";
import { autoAllocateWarehouses } from "./autoAllocateWarehouses";
import { getWarehouseAvailability, type WarehouseAvailability } from "./getWarehouseAvailability";

export type ResolveAllocationsResult =
  { allocations: BillLineAllocationInput[]; fellBack?: boolean } | { error: string };

// With one warehouse in the store, the split is invisible — the whole
// quantity allocates there automatically. With more than one and no
// explicit split from the cashier, autoAllocateWarehouses picks it
// (oldest-stocked warehouse first, preferring a single warehouse over a
// split). An explicit `requested` array — the cashier's manual override —
// wins over the automatic pick, PROVIDED it still holds up against live
// availability: the cart is built client-side and a manual pick can go
// stale between when the cashier chose it and when the bill is actually
// saved, so a requested split that no longer has the stock is silently
// dropped in favor of a fresh auto-allocation (`fellBack: true` on the
// result) rather than hard-failing the save.
// Pass an already-computed `perWarehouse` availability list (from the
// caller's own oversell check) to avoid recomputing it.
export async function resolveAllocations(params: {
  storeId: string;
  productId: string;
  quantity: number;
  requested?: BillLineAllocationInput[];
  perWarehouse?: WarehouseAvailability[];
}): Promise<ResolveAllocationsResult> {
  const db = unscoped();
  const warehouses = await db.warehouse.findMany({
    where: { storeId: params.storeId, isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (warehouses.length === 0) {
    return { error: "This store has no active warehouse to allocate stock from." };
  }

  if (params.requested && params.requested.length > 0) {
    const total = params.requested.reduce((sum, a) => sum + a.quantity, 0);
    if (total !== params.quantity) {
      return {
        error: `Warehouse allocations must add up to ${params.quantity}, not ${total}.`,
      };
    }
    const validIds = new Set(warehouses.map((w) => w.id));
    for (const allocation of params.requested) {
      if (!validIds.has(allocation.warehouseId)) {
        return { error: "One of the selected warehouses doesn't belong to this store." };
      }
    }

    const perWarehouse =
      params.perWarehouse ?? (await getWarehouseAvailability(params.storeId, params.productId));
    const availableById = new Map(perWarehouse.map((w) => [w.warehouseId, w.available]));
    const stale = params.requested.some(
      (a) => (availableById.get(a.warehouseId) ?? 0) < a.quantity,
    );
    if (!stale) {
      return { allocations: params.requested };
    }
    // Falls through to a fresh auto-allocation below.
  }

  if (warehouses.length === 1) {
    return {
      allocations: [{ warehouseId: warehouses[0].id, quantity: params.quantity }],
      fellBack: !!params.requested?.length,
    };
  }

  const auto = await autoAllocateWarehouses({
    storeId: params.storeId,
    productId: params.productId,
    quantity: params.quantity,
    perWarehouse: params.perWarehouse,
  });
  if ("error" in auto) return auto;
  return { ...auto, fellBack: !!params.requested?.length };
}
