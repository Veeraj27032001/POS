import { unscoped } from "@/lib/db";

// A completed bill's own consumption isn't a StockBlock (that's only how
// draft/held bills reserve stock) — it's counted directly as "sold" via
// this line's own billLineWarehouseAllocation rows. Editing the quantity
// on an already-completed line needs to add that back before checking the
// new quantity, the same way getSelfBlockedByWarehouse does for a held
// bill's reservation.
export async function getSelfSoldByWarehouse(
  billId: string,
  productId: string,
): Promise<Map<string, number>> {
  const db = unscoped();
  const selfSold = new Map<string, number>();

  const line = await db.billLine.findFirst({
    where: { billId, productId, status: "active" },
    select: { id: true },
  });
  if (!line) return selfSold;

  const allocations = await db.billLineWarehouseAllocation.findMany({
    where: { billLineId: line.id },
  });
  for (const alloc of allocations) {
    selfSold.set(alloc.warehouseId, (selfSold.get(alloc.warehouseId) ?? 0) + alloc.quantity);
  }
  return selfSold;
}
