import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

export interface WarehouseAvailability {
  warehouseId: string;
  available: number;
}

// The single place a product's per-warehouse availability across a store is
// computed — getStoreWideAvailable's sum and autoAllocateWarehouses' picking
// logic both need this same figure, so it's computed once (in parallel
// across warehouses) and shared rather than each recomputing it themselves.
export async function getWarehouseAvailability(
  storeId: string,
  productId: string,
): Promise<WarehouseAvailability[]> {
  const db = unscoped();
  const warehouses = await db.warehouse.findMany({
    where: { storeId, isActive: true, isDeleted: false },
    select: { id: true },
  });

  return Promise.all(
    warehouses.map(async (warehouse) => {
      const { available } = await getStockLevels({ productId, warehouseId: warehouse.id });
      return { warehouseId: warehouse.id, available };
    }),
  );
}
