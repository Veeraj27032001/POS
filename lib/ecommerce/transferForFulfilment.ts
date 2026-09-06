import type { Prisma } from "@/generated/prisma/client";
import type { FulfilmentAllocation } from "@/lib/ecommerce/resolveFulfilment";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";

// When the billing store can't cover the whole order on its own, the stock
// comes to it from another store first — a real Stock Transfer, auto-accepted
// because it exists only to fulfil an order that's already paid for. The
// customer still gets one bill, from the store that hands the order over.
export async function transferStockForFulfilment(
  tx: Prisma.TransactionClient,
  params: {
    allocations: FulfilmentAllocation[];
    billingStoreId: string;
    destinationWarehouseId: string;
    financialYearId: string;
    userId: string;
    products: Map<
      string,
      { name: string; systemBarcode: string; price: unknown; hsnCode: { hsnCode: string } | null }
    >;
  },
): Promise<void> {
  const foreign = params.allocations.filter((a) => a.storeId !== params.billingStoreId);
  if (foreign.length === 0) return;

  // One transfer document per source store × source warehouse.
  const bySource = new Map<string, FulfilmentAllocation[]>();
  for (const allocation of foreign) {
    const key = `${allocation.storeId}:${allocation.warehouseId}`;
    const existing = bySource.get(key) ?? [];
    existing.push(allocation);
    bySource.set(key, existing);
  }

  const now = new Date();
  for (const [key, allocations] of bySource) {
    const [sourceStoreId, sourceWarehouseId] = key.split(":");

    const { documentNumber } = await allocateDocumentNumber(tx, {
      seriesType: "stock_transfer",
      storeId: sourceStoreId,
      financialYearId: params.financialYearId,
    });

    const main = await tx.stockTransferMain.create({
      data: {
        documentNumber,
        financialYearId: params.financialYearId,
        storeId: sourceStoreId,
        sourceWarehouseId,
        destinationStoreId: params.billingStoreId,
        status: "accepted",
        requestedByUserId: params.userId,
        requestedAt: now,
        respondedByUserId: params.userId,
        respondedAt: now,
        receivedDate: now,
        notes: "Auto-transfer to fulfil an online order",
      },
    });

    for (const allocation of allocations) {
      const product = params.products.get(allocation.productId)!;
      await tx.stockTransferItem.create({
        data: {
          stockTransferMainId: main.id,
          productId: allocation.productId,
          productName: product.name,
          productBarcode: product.systemBarcode,
          productPrice: product.price as never,
          productHsnCode: product.hsnCode?.hsnCode ?? null,
          quantity: allocation.quantity,
          destinationWarehouseId: params.destinationWarehouseId,
          quantityAccepted: allocation.quantity,
          quantityRejected: 0,
        },
      });
    }
  }
}
