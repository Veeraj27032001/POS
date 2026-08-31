import { unscoped } from "@/lib/db";

import type { BillLineAllocationInput } from "./allocateBillLineStock";
import { autoAllocateWarehouses } from "./autoAllocateWarehouses";
import type { WarehouseAvailability } from "./getWarehouseAvailability";

export type ResolveAllocationsResult =
  { allocations: BillLineAllocationInput[] } | { error: string };

// With one warehouse in the store, the split is invisible — the whole
// quantity allocates there automatically. With more than one and no
// explicit split from the cashier, autoAllocateWarehouses picks it
// (oldest-stocked warehouse first, preferring a single warehouse over a
// split). An explicit `requested` array — the cashier's manual override —
// is validated to sum to `quantity` and always wins over the automatic pick.
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
    return { allocations: params.requested };
  }

  if (warehouses.length === 1) {
    return { allocations: [{ warehouseId: warehouses[0].id, quantity: params.quantity }] };
  }

  return autoAllocateWarehouses({
    storeId: params.storeId,
    productId: params.productId,
    quantity: params.quantity,
    perWarehouse: params.perWarehouse,
  });
}
