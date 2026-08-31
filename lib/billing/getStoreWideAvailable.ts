import { getWarehouseAvailability, type WarehouseAvailability } from "./getWarehouseAvailability";

// step5 §7.8: oversell prevention checks `available` summed across every
// warehouse in the store, not just one — a line can draw from more than one
// warehouse, so whether it fits at all is a store-wide question. Pass an
// already-computed `perWarehouse` list (e.g. from autoAllocateWarehouses'
// own lookup) to avoid recomputing it twice for the same add/edit.
export async function getStoreWideAvailable(
  storeId: string,
  productId: string,
  perWarehouse?: WarehouseAvailability[],
): Promise<number> {
  const levels = perWarehouse ?? (await getWarehouseAvailability(storeId, productId));
  return levels.reduce((sum, level) => sum + level.available, 0);
}
