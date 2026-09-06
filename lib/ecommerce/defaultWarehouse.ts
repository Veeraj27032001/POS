import { unscoped } from "@/lib/db";

// A real shopper never picks a warehouse — the storefront always fulfils
// from the store's default (first active) one, same idea as a single
// "front of store" location.
export async function getDefaultWarehouseId(storeId: string): Promise<string | null> {
  const warehouse = await unscoped().warehouse.findFirst({
    where: { storeId, isActive: true, isDeleted: false },
    orderBy: { name: "asc" },
  });
  return warehouse?.id ?? null;
}
