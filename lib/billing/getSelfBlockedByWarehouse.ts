import { unscoped } from "@/lib/db";

import type { WarehouseAvailability } from "./getWarehouseAvailability";

export async function getSelfBlockedByWarehouse(
  billId: string,
  productId: string,
): Promise<Map<string, number>> {
  const db = unscoped();
  const selfBlocked = new Map<string, number>();

  const line = await db.billLine.findFirst({
    where: { billId, productId, status: "active" },
    select: { id: true },
  });
  if (!line) return selfBlocked;

  const allocations = await db.billLineWarehouseAllocation.findMany({
    where: { billLineId: line.id },
  });
  await Promise.all(
    allocations.map(async (alloc) => {
      const agg = await db.stockBlockItem.aggregate({
        _sum: { quantityBlocked: true },
        where: {
          status: "active",
          stockBlockMain: { sourceType: "draft_bill_line", sourceId: alloc.id },
        },
      });
      const qty = agg._sum.quantityBlocked ?? 0;
      selfBlocked.set(alloc.warehouseId, (selfBlocked.get(alloc.warehouseId) ?? 0) + qty);
    }),
  );
  return selfBlocked;
}

export function applySelfBlocked(
  perWarehouse: WarehouseAvailability[],
  selfBlocked: Map<string, number>,
): WarehouseAvailability[] {
  if (selfBlocked.size === 0) return perWarehouse;
  return perWarehouse.map((w) => ({
    ...w,
    available: w.available + (selfBlocked.get(w.warehouseId) ?? 0),
  }));
}
