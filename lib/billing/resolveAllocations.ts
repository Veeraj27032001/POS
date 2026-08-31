import { unscoped } from "@/lib/db";

import type { BillLineAllocationInput } from "./allocateBillLineStock";
import { autoAllocateWarehouses } from "./autoAllocateWarehouses";
import { getWarehouseAvailability, type WarehouseAvailability } from "./getWarehouseAvailability";

export type ResolveAllocationsResult =
  { allocations: BillLineAllocationInput[]; fellBack?: boolean } | { error: string };

// A manual `requested` split wins over auto-allocation, provided it still
// holds up against live availability — otherwise falls back to a fresh
// auto-allocation (`fellBack: true`) rather than hard-failing.
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
