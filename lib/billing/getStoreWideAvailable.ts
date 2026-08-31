import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

// step5 §7.8: oversell prevention checks `available` summed across every
// warehouse in the store, not just one — a line can draw from more than one
// warehouse, so whether it fits at all is a store-wide question.
export async function getStoreWideAvailable(storeId: string, productId: string): Promise<number> {
  const warehouses = await unscoped().warehouse.findMany({
    where: { storeId, isActive: true, isDeleted: false },
    select: { id: true },
  });
  const levels = await Promise.all(
    warehouses.map((w) => getStockLevels({ productId, warehouseId: w.id })),
  );
  return levels.reduce((sum, level) => sum + level.available, 0);
}
