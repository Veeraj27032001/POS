import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

export interface CrossStoreWarehouseAvailability {
  storeId: string;
  storeName: string;
  warehouseId: string;
  warehouseName: string;
  available: number;
}

// Same idea as lib/billing/getWarehouseAvailability.ts, but system-wide
// instead of scoped to one store — this is what lets the Generate Bill
// review page offer a real per-line source picker across every store, not
// just the one the order happened to resolve to at placement time.
export async function getCrossStoreWarehouseAvailability(
  productId: string,
): Promise<CrossStoreWarehouseAvailability[]> {
  const db = unscoped();
  const warehouses = await db.warehouse.findMany({
    where: { isActive: true, isDeleted: false, store: { isActive: true, isDeleted: false } },
    select: { id: true, name: true, storeId: true, store: { select: { name: true } } },
  });

  const withStore = warehouses.filter(
    (w): w is typeof w & { storeId: string; store: { name: string } } =>
      Boolean(w.storeId && w.store),
  );

  return Promise.all(
    withStore.map(async (w) => {
      const { available } = await getStockLevels({ productId, warehouseId: w.id });
      return {
        storeId: w.storeId,
        storeName: w.store.name,
        warehouseId: w.id,
        warehouseName: w.name,
        available,
      };
    }),
  );
}
