import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

export interface FulfilmentRequestLine {
  productId: string;
  quantity: number;
}

export interface FulfilmentAllocation {
  storeId: string;
  warehouseId: string;
  productId: string;
  quantity: number;
}

export type FulfilmentResult =
  { ok: true; allocations: FulfilmentAllocation[] } | { ok: false; reason: string };

interface StoreAvailability {
  storeId: string;
  // Per product: how much is available, and where it sits.
  byProduct: Map<string, { warehouseId: string; available: number }[]>;
}

async function loadAvailability(
  storeIds: string[],
  productIds: string[],
): Promise<StoreAvailability[]> {
  const db = unscoped();
  const result: StoreAvailability[] = [];

  for (const storeId of storeIds) {
    const warehouses = await db.warehouse.findMany({
      where: { storeId, isActive: true, isDeleted: false },
      select: { id: true },
      orderBy: { name: "asc" },
    });

    const byProduct = new Map<string, { warehouseId: string; available: number }[]>();
    for (const productId of productIds) {
      const perWarehouse: { warehouseId: string; available: number }[] = [];
      for (const warehouse of warehouses) {
        const { available } = await getStockLevels({ productId, warehouseId: warehouse.id });
        if (available > 0) perWarehouse.push({ warehouseId: warehouse.id, available });
      }
      byProduct.set(productId, perWarehouse);
    }
    result.push({ storeId, byProduct });
  }

  return result;
}

function storeTotalFor(store: StoreAvailability, productId: string): number {
  return (store.byProduct.get(productId) ?? []).reduce((sum, w) => sum + w.available, 0);
}

function canCoverEverything(store: StoreAvailability, lines: FulfilmentRequestLine[]): boolean {
  return lines.every((line) => storeTotalFor(store, line.productId) >= line.quantity);
}

// Spreads one line's quantity across a store's own warehouses.
function allocateWithinStore(
  store: StoreAvailability,
  productId: string,
  quantity: number,
): FulfilmentAllocation[] {
  const allocations: FulfilmentAllocation[] = [];
  let remaining = quantity;
  for (const warehouse of store.byProduct.get(productId) ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, warehouse.available);
    allocations.push({
      storeId: store.storeId,
      warehouseId: warehouse.warehouseId,
      productId,
      quantity: take,
    });
    remaining -= take;
  }
  return allocations;
}

// Decides which store(s) fulfil an order.
//
// 1. The preferred (billing) store's own stock is always used first — never
//    skipped in favour of some other store that merely happens to have more.
//    If it alone covers the whole order, that's the answer: one store, no
//    transfer.
// 2. If it falls short and splitting is allowed, the shortfall is topped up
//    from the other eligible stores, in order — this is the normal
//    "auto-distribute" case: the billing store's own units are still used,
//    only the gap moves in from elsewhere.
// 3. If splitting isn't allowed, blending sources isn't an option — instead,
//    fall back to a single *other* store that can cover the whole order by
//    itself (still just one source, just not the preferred one).
export async function resolveFulfilment(params: {
  storeIds: string[];
  preferredStoreId: string;
  lines: FulfilmentRequestLine[];
  allowSplit: boolean;
}): Promise<FulfilmentResult> {
  const productIds = [...new Set(params.lines.map((l) => l.productId))];
  const stores = await loadAvailability(params.storeIds, productIds);
  const preferred = stores.find((s) => s.storeId === params.preferredStoreId);
  const others = stores.filter((s) => s.storeId !== params.preferredStoreId);

  if (preferred && canCoverEverything(preferred, params.lines)) {
    return {
      ok: true,
      allocations: params.lines.flatMap((line) =>
        allocateWithinStore(preferred, line.productId, line.quantity),
      ),
    };
  }

  if (!params.allowSplit) {
    const alternate = others.find((s) => canCoverEverything(s, params.lines));
    if (alternate) {
      return {
        ok: true,
        allocations: params.lines.flatMap((line) =>
          allocateWithinStore(alternate, line.productId, line.quantity),
        ),
      };
    }
    return {
      ok: false,
      reason:
        "No single store has enough stock for this order, and splitting across stores is turned off for this integration.",
    };
  }

  // Top up the shortfall: the preferred store's own stock first, then the
  // other eligible stores in order.
  const ordered = preferred ? [preferred, ...others] : others;
  const allocations: FulfilmentAllocation[] = [];
  for (const line of params.lines) {
    let remaining = line.quantity;
    for (const store of ordered) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, storeTotalFor(store, line.productId));
      if (take <= 0) continue;
      allocations.push(...allocateWithinStore(store, line.productId, take));
      remaining -= take;
    }
    if (remaining > 0) {
      const totalAvailable = line.quantity - remaining;
      return {
        ok: false,
        reason: `Only ${totalAvailable} available across all stores for product ${line.productId}.`,
      };
    }
  }

  return { ok: true, allocations };
}
