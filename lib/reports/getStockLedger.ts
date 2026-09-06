import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";

export interface StockLedgerRow {
  date: string;
  docType: string;
  docNumber: string;
  qtyIn: number;
  qtyOut: number;
  runningBalance: number;
}

export interface StockLedgerResult {
  openingBalance: number;
  closingBalance: number;
  rows: StockLedgerRow[];
}

function dayBefore(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

// step6's Stock Ledger: opening/closing are the same on_hand computation
// read at the FY's two date boundaries, not a separately stored figure.
export async function getStockLedger(params: {
  productId: string;
  warehouseId: string;
  fyStart: Date;
  fyEnd: Date;
}): Promise<StockLedgerResult> {
  const { productId, warehouseId, fyStart, fyEnd } = params;
  const db = unscoped();

  const [opening, closing] = await Promise.all([
    getStockLevels({ productId, warehouseId, asOfDate: dayBefore(fyStart) }),
    getStockLevels({ productId, warehouseId, asOfDate: fyEnd }),
  ]);

  const within = { gte: fyStart, lte: fyEnd };

  const [
    inward,
    damage,
    transferIn,
    transferOut,
    positiveAdj,
    negativeAdj,
    opening_,
    qualityCheck,
    sold,
    returned,
  ] = await Promise.all([
    db.stockInwardItem.findMany({
      where: { productId, stockInwardMain: { warehouseId, inwardDate: within } },
      select: {
        quantityAccepted: true,
        stockInwardMain: { select: { documentNumber: true, inwardDate: true } },
      },
    }),
    db.stockDamageItem.findMany({
      where: { productId, stockDamageMain: { warehouseId, damageDate: within } },
      select: {
        quantity: true,
        stockDamageMain: { select: { documentNumber: true, damageDate: true } },
      },
    }),
    db.stockTransferItem.findMany({
      where: {
        productId,
        destinationWarehouseId: warehouseId,
        stockTransferMain: { status: "accepted", respondedAt: within },
      },
      select: {
        quantityAccepted: true,
        stockTransferMain: { select: { documentNumber: true, respondedAt: true } },
      },
    }),
    db.stockTransferItem.findMany({
      where: {
        productId,
        stockTransferMain: {
          sourceWarehouseId: warehouseId,
          status: "accepted",
          respondedAt: within,
        },
      },
      select: {
        quantityAccepted: true,
        stockTransferMain: { select: { documentNumber: true, respondedAt: true } },
      },
    }),
    db.stockPositiveAdjustmentItem.findMany({
      where: { productId, stockPositiveAdjustmentMain: { warehouseId, adjustmentDate: within } },
      select: {
        quantity: true,
        stockPositiveAdjustmentMain: { select: { documentNumber: true, adjustmentDate: true } },
      },
    }),
    db.stockNegativeAdjustmentItem.findMany({
      where: { productId, stockNegativeAdjustmentMain: { warehouseId, adjustmentDate: within } },
      select: {
        quantity: true,
        stockNegativeAdjustmentMain: { select: { documentNumber: true, adjustmentDate: true } },
      },
    }),
    db.stockOpeningItem.findMany({
      where: { productId, stockOpeningMain: { warehouseId, openingDate: within } },
      select: {
        quantity: true,
        stockOpeningMain: { select: { documentNumber: true, openingDate: true } },
      },
    }),
    db.stockQualityCheckItem.findMany({
      where: { productId, stockQualityCheckMain: { warehouseId, checkDate: within } },
      select: {
        quantity: true,
        stockQualityCheckMain: { select: { documentNumber: true, checkDate: true } },
      },
    }),
    db.billLineWarehouseAllocation.findMany({
      where: {
        warehouseId,
        billLine: {
          productId,
          status: "active",
          bill: { status: "completed", completedAt: within },
        },
      },
      select: {
        quantity: true,
        billLine: { select: { bill: { select: { documentNumber: true, completedAt: true } } } },
      },
    }),
    db.billReturnLine.findMany({
      where: {
        warehouseId,
        condition: "sellable",
        billLine: { productId },
        return: { createdAt: within },
      },
      select: {
        quantity: true,
        return: { select: { documentNumber: true, createdAt: true } },
      },
    }),
  ]);

  const rows: (StockLedgerRow & { sortDate: Date })[] = [];

  for (const item of inward) {
    rows.push({
      date: item.stockInwardMain.inwardDate.toISOString(),
      sortDate: item.stockInwardMain.inwardDate,
      docType: "Stock Inward",
      docNumber: item.stockInwardMain.documentNumber,
      qtyIn: item.quantityAccepted,
      qtyOut: 0,
      runningBalance: 0,
    });
  }
  for (const item of damage) {
    rows.push({
      date: item.stockDamageMain.damageDate.toISOString(),
      sortDate: item.stockDamageMain.damageDate,
      docType: "Stock Damage",
      docNumber: item.stockDamageMain.documentNumber,
      qtyIn: 0,
      qtyOut: item.quantity,
      runningBalance: 0,
    });
  }
  for (const item of transferIn) {
    if (!item.stockTransferMain.respondedAt) continue;
    rows.push({
      date: item.stockTransferMain.respondedAt.toISOString(),
      sortDate: item.stockTransferMain.respondedAt,
      docType: "Stock Transfer In",
      docNumber: item.stockTransferMain.documentNumber,
      qtyIn: item.quantityAccepted ?? 0,
      qtyOut: 0,
      runningBalance: 0,
    });
  }
  for (const item of transferOut) {
    if (!item.stockTransferMain.respondedAt) continue;
    rows.push({
      date: item.stockTransferMain.respondedAt.toISOString(),
      sortDate: item.stockTransferMain.respondedAt,
      docType: "Stock Transfer Out",
      docNumber: item.stockTransferMain.documentNumber,
      qtyIn: 0,
      qtyOut: item.quantityAccepted ?? 0,
      runningBalance: 0,
    });
  }
  for (const item of positiveAdj) {
    rows.push({
      date: item.stockPositiveAdjustmentMain.adjustmentDate.toISOString(),
      sortDate: item.stockPositiveAdjustmentMain.adjustmentDate,
      docType: "Positive Adjustment",
      docNumber: item.stockPositiveAdjustmentMain.documentNumber,
      qtyIn: item.quantity,
      qtyOut: 0,
      runningBalance: 0,
    });
  }
  for (const item of negativeAdj) {
    rows.push({
      date: item.stockNegativeAdjustmentMain.adjustmentDate.toISOString(),
      sortDate: item.stockNegativeAdjustmentMain.adjustmentDate,
      docType: "Negative Adjustment",
      docNumber: item.stockNegativeAdjustmentMain.documentNumber,
      qtyIn: 0,
      qtyOut: item.quantity,
      runningBalance: 0,
    });
  }
  for (const item of opening_) {
    rows.push({
      date: item.stockOpeningMain.openingDate.toISOString(),
      sortDate: item.stockOpeningMain.openingDate,
      docType: "Opening Balance",
      docNumber: item.stockOpeningMain.documentNumber,
      qtyIn: item.quantity,
      qtyOut: 0,
      runningBalance: 0,
    });
  }
  for (const item of qualityCheck) {
    rows.push({
      date: item.stockQualityCheckMain.checkDate.toISOString(),
      sortDate: item.stockQualityCheckMain.checkDate,
      docType: "Quality Check",
      docNumber: item.stockQualityCheckMain.documentNumber,
      qtyIn: 0,
      qtyOut: item.quantity,
      runningBalance: 0,
    });
  }
  for (const item of sold) {
    const bill = item.billLine.bill;
    if (!bill.completedAt) continue;
    rows.push({
      date: bill.completedAt.toISOString(),
      sortDate: bill.completedAt,
      docType: "Sale",
      docNumber: bill.documentNumber,
      qtyIn: 0,
      qtyOut: item.quantity,
      runningBalance: 0,
    });
  }
  for (const item of returned) {
    rows.push({
      date: item.return.createdAt.toISOString(),
      sortDate: item.return.createdAt,
      docType: "Return",
      docNumber: item.return.documentNumber,
      qtyIn: item.quantity,
      qtyOut: 0,
      runningBalance: 0,
    });
  }

  rows.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

  let running = opening.onHand;
  for (const row of rows) {
    running += row.qtyIn - row.qtyOut;
    row.runningBalance = running;
  }

  return {
    openingBalance: opening.onHand,
    closingBalance: closing.onHand,
    rows: rows.map(({ sortDate: _sortDate, ...row }) => row),
  };
}
