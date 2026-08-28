import { unscoped } from "@/lib/db";

export interface StockLevels {
  onHand: number;
  available: number;
  expiredNotInvalidated: number;
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
  const cutoff = asOfDate ?? new Date();
  const createdAtCutoff = asOfDate ? { createdAt: { lte: asOfDate } } : {};

  const [
    inward,
    transferIn,
    transferOut,
    positiveAdj,
    opening,
    damage,
    negativeAdj,
    blocked,
    expiredInward,
    expiredTransferIn,
    expiredPositiveAdj,
    expiredOpening,
  ] = await Promise.all([
    db.stockInwardItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        expiryInvalidated: false,
        stockInwardMain: { warehouseId, ...createdAtCutoff },
      },
    }),
    db.stockTransferItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        expiryInvalidated: false,
        stockTransferMain: {
          destinationWarehouseId: warehouseId,
          status: "accepted",
          ...(asOfDate ? { respondedAt: { lte: asOfDate } } : {}),
        },
      },
    }),
    db.stockTransferItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        stockTransferMain: {
          sourceWarehouseId: warehouseId,
          status: "accepted",
          ...(asOfDate ? { respondedAt: { lte: asOfDate } } : {}),
        },
      },
    }),
    db.stockPositiveAdjustmentItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        expiryInvalidated: false,
        stockPositiveAdjustmentMain: { warehouseId, ...createdAtCutoff },
      },
    }),
    db.stockOpeningItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        expiryInvalidated: false,
        stockOpeningMain: { warehouseId, ...createdAtCutoff },
      },
    }),
    db.stockDamageItem.aggregate({
      _sum: { quantity: true },
      where: { productId, stockDamageMain: { warehouseId, ...createdAtCutoff } },
    }),
    db.stockNegativeAdjustmentItem.aggregate({
      _sum: { quantity: true },
      where: { productId, stockNegativeAdjustmentMain: { warehouseId, ...createdAtCutoff } },
    }),
    db.stockBlockItem.aggregate({
      _sum: { quantityBlocked: true },
      where: {
        productId,
        status: "active",
        stockBlockMain: { warehouseId, ...(asOfDate ? { blockedAt: { lte: asOfDate } } : {}) },
      },
    }),
    db.stockInwardItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        expiryInvalidated: false,
        expiryDate: { lt: cutoff },
        stockInwardMain: { warehouseId, ...createdAtCutoff },
      },
    }),
    db.stockTransferItem.aggregate({
      _sum: { quantityAccepted: true },
      where: {
        productId,
        expiryInvalidated: false,
        expiryDate: { lt: cutoff },
        stockTransferMain: {
          destinationWarehouseId: warehouseId,
          status: "accepted",
          ...(asOfDate ? { respondedAt: { lte: asOfDate } } : {}),
        },
      },
    }),
    db.stockPositiveAdjustmentItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        expiryInvalidated: false,
        expiryDate: { lt: cutoff },
        stockPositiveAdjustmentMain: { warehouseId, ...createdAtCutoff },
      },
    }),
    db.stockOpeningItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        expiryInvalidated: false,
        expiryDate: { lt: cutoff },
        stockOpeningMain: { warehouseId, ...createdAtCutoff },
      },
    }),
  ]);

  // TODO(step5): subtract active/completed Bill Line Warehouse Allocation
  // quantity, add sellable Return Line quantity, once billing exists.
  const onHand =
    sum(inward._sum.quantityAccepted) +
    sum(transferIn._sum.quantityAccepted) -
    sum(transferOut._sum.quantityAccepted) +
    sum(positiveAdj._sum.quantity) +
    sum(opening._sum.quantity) -
    sum(damage._sum.quantity) -
    sum(negativeAdj._sum.quantity);

  const available = onHand - sum(blocked._sum.quantityBlocked);

  const expiredNotInvalidated =
    sum(expiredInward._sum.quantityAccepted) +
    sum(expiredTransferIn._sum.quantityAccepted) +
    sum(expiredPositiveAdj._sum.quantity) +
    sum(expiredOpening._sum.quantity);

  return { onHand, available, expiredNotInvalidated };
}
