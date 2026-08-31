import type { Prisma } from "@/generated/prisma/client";

import type { BillLineAllocationInput } from "./allocateBillLineStock";

export type ResolveAllocationsResult =
  { allocations: BillLineAllocationInput[] } | { error: string };

// With one warehouse in the store, the split is invisible — the whole
// quantity allocates there automatically. With more than one, the cashier
// has to say how the quantity splits, so an explicit `requested` array is
// required and validated to sum to `quantity`.
export async function resolveAllocations(
  tx: Prisma.TransactionClient,
  params: { storeId: string; quantity: number; requested?: BillLineAllocationInput[] },
): Promise<ResolveAllocationsResult> {
  const warehouses = await tx.warehouse.findMany({
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

  return {
    error:
      "This store has more than one warehouse — choose how to split this quantity across them.",
  };
}
