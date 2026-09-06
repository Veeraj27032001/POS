import { getStockLevels } from "@/lib/stock/getStockLevels";

export interface StoreAvailability {
  storeId: string;
  storeName: string;
  available: number;
}

export interface StoreWithWarehouses {
  storeId: string;
  storeName: string;
  warehouseIds: string[];
}

// The aggregated `available` a multi-store credential's products endpoints
// return hides *which* eligible store the stock actually sits in — no help
// to a caller that lets the shopper pick a store via stock-lock/bills'
// storeId. This gives both: the total, and the per-store split it's made of.
export async function getProductAvailability(
  productId: string,
  stores: StoreWithWarehouses[],
): Promise<{ available: number; stockByStore: StoreAvailability[] }> {
  const stockByStore: StoreAvailability[] = [];
  let available = 0;
  for (const store of stores) {
    let storeAvailable = 0;
    for (const warehouseId of store.warehouseIds) {
      const levels = await getStockLevels({ productId, warehouseId });
      storeAvailable += levels.available;
    }
    stockByStore.push({
      storeId: store.storeId,
      storeName: store.storeName,
      available: storeAvailable,
    });
    available += storeAvailable;
  }
  return { available, stockByStore };
}
