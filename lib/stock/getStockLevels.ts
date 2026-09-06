import { unscoped } from "@/lib/db";

export interface StockLevels {
  onHand: number;
  available: number;
}

export interface GetStockLevelsParams {
  productId: string;
  warehouseId: string;
  asOfDate?: Date;
}

function sum(value: number | null | undefined): number {
  return value ?? 0;
}

// The single place step4 §7's stock formula lives — every consumer
// (billing's oversell check, low stock, this page's totals) calls this
// instead of re-deriving the sum itself.
export async function getStockLevels({
  productId,
  warehouseId,
  asOfDate,
}: GetStockLevelsParams): Promise<StockLevels> {
  const db = unscoped();
  // Each document's own user-selected movement date gates whether it counts
  // yet — not when the row was written to the DB. Defaults to now, so a
  // document dated today counts and one dated after today doesn't.
  const cutoff = asOfDate ?? new Date();

  const [
    inward,
    transferIn,
    transferOut,
    positiveAdj,
    opening,
    damage,
    negativeAdj,
    qualityCheck,
    blocked,
    sold,
    returnedSellable,
  ] = await Promise.all([
    db.stockInwardItem.aggregate({
      _sum: { quantityAccepted: true },
      where: { productId, stockInwardMain: { warehouseId, inwardDate: { lte: cutoff } } },
    }),
    db.stockTransferItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        destinationWarehouseId: warehouseId,
        stockTransferMain: { status: "accepted", respondedAt: { lte: cutoff } },
      },
    }),
    db.stockTransferItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        stockTransferMain: {
          sourceWarehouseId: warehouseId,
          status: "accepted",
          respondedAt: { lte: cutoff },
        },
      },
    }),
    db.stockPositiveAdjustmentItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        stockPositiveAdjustmentMain: { warehouseId, adjustmentDate: { lte: cutoff } },
      },
    }),
    db.stockOpeningItem.aggregate({
      _sum: { quantity: true },
      where: { productId, stockOpeningMain: { warehouseId, openingDate: { lte: cutoff } } },
    }),
    db.stockDamageItem.aggregate({
      _sum: { quantity: true },
      where: { productId, stockDamageMain: { warehouseId, damageDate: { lte: cutoff } } },
    }),
    db.stockNegativeAdjustmentItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        stockNegativeAdjustmentMain: { warehouseId, adjustmentDate: { lte: cutoff } },
      },
    }),
    db.stockQualityCheckItem.aggregate({
      _sum: { quantity: true },
      where: { productId, stockQualityCheckMain: { warehouseId, checkDate: { lte: cutoff } } },
    }),
    db.stockBlockItem.aggregate({
      _sum: { quantityBlocked: true },
      where: {
        productId,
        status: "active",
        stockBlockMain: {
          warehouseId,
          blockedAt: { lte: cutoff },
          OR: [{ expiresAt: null }, { expiresAt: { gt: cutoff } }],
        },
      },
    }),
    db.billLineWarehouseAllocation.aggregate({
      _sum: { quantity: true },
      where: {
        warehouseId,
        billLine: {
          productId,
          status: "active",
          bill: { status: "completed", completedAt: { lte: cutoff } },
        },
      },
    }),
    db.billReturnLine.aggregate({
      _sum: { quantity: true },
      where: {
        warehouseId,
        condition: "sellable",
        billLine: { productId },
        return: { createdAt: { lte: cutoff } },
      },
    }),
  ]);

  const onHand =
    sum(inward._sum.quantityAccepted) +
    sum(transferIn._sum.quantityAccepted) -
    sum(transferOut._sum.quantityAccepted) +
    sum(positiveAdj._sum.quantity) +
    sum(opening._sum.quantity) -
    sum(damage._sum.quantity) -
    sum(negativeAdj._sum.quantity) -
    sum(qualityCheck._sum.quantity) -
    sum(sold._sum.quantity) +
    sum(returnedSellable._sum.quantity);

  const available = onHand - sum(blocked._sum.quantityBlocked);

  return { onHand, available };
}
