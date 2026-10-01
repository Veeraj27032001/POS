import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { env } from "@/lib/config/env";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, todayAsDateOnly } from "@/lib/datetime/dateOnly";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Mirrors app/api/stock-blocks/stale/route.ts's own fixed default — no
// settings UI exists for this yet, so both routes hardcode the same value.
const STALE_BLOCK_DEFAULT_DAYS = 7;
const LOW_STOCK_QUICK_LIST_SIZE = 5;
const STALE_QUICK_LIST_SIZE = 5;

export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const storeId = session.user.storeId;
  if (!storeId) {
    // A cross-store viewer (Super Admin) has no till of their own, so the
    // operational blocks below mean nothing to them — they get an estate-wide
    // picture of the stores they administer instead.
    const db = unscoped();
    const [stores, userCount, productCount] = await Promise.all([
      db.store.findMany({
        where: { isDeleted: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, isActive: true },
      }),
      db.user.count({ where: { isDeleted: false, isActive: true } }),
      db.product.count({ where: { isDeleted: false, isActive: true } }),
    ]);

    const storeIds = stores.map((s) => s.id);
    const [terminalCount, warehouseCount] = await Promise.all([
      db.terminal.count({ where: { storeId: { in: storeIds }, isDeleted: false, isActive: true } }),
      db.warehouse.count({
        where: { storeId: { in: storeIds }, isDeleted: false, isActive: true },
      }),
    ]);

    return Response.json({
      hasStore: false,
      estate: {
        stores: stores.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          isActive: s.isActive,
        })),
        activeStores: stores.filter((s) => s.isActive).length,
        users: userCount,
        products: productCount,
        terminals: terminalCount,
        warehouses: warehouseCount,
      },
    });
  }

  return withStoreContext(async () => {
    const db = unscoped();
    const now = new Date();
    const today = dateOnlyToUtcMidnight(todayAsDateOnly());
    const staleBlockCutoff = new Date(
      now.getTime() - STALE_BLOCK_DEFAULT_DAYS * 24 * 60 * 60 * 1000,
    );
    const staleHeldCutoff = new Date(now.getTime() - env().STALE_HELD_BILL_HOURS * 60 * 60 * 1000);

    const staleBlockWhere = {
      status: "active" as const,
      stockBlockMain: {
        storeId,
        OR: [
          { reviewByDate: { lt: now } },
          { reviewByDate: null, blockedAt: { lt: staleBlockCutoff } },
        ],
      },
    };

    const staleHeldWhere = { storeId, status: "held" as const, heldAt: { lt: staleHeldCutoff } };

    const [
      todaySales,
      warehouses,
      staleBlockCount,
      staleBlockItems,
      staleHeldCount,
      staleHeldBills,
      outgoingTransfers,
      incomingTransfers,
      creditBills,
      lowStockCandidates,
    ] = await Promise.all([
      db.bill.groupBy({
        by: ["billType"],
        where: { storeId, status: "completed", billDate: today },
        _sum: { grandTotal: true },
        _count: true,
      }),
      db.warehouse.findMany({
        where: { storeId, isActive: true, isDeleted: false },
        select: { id: true },
      }),
      db.stockBlockItem.count({ where: staleBlockWhere }),
      db.stockBlockItem.findMany({
        where: staleBlockWhere,
        select: { id: true, productName: true, quantityBlocked: true },
        orderBy: { id: "desc" },
        take: STALE_QUICK_LIST_SIZE,
      }),
      db.bill.count({ where: staleHeldWhere }),
      db.bill.findMany({
        where: staleHeldWhere,
        select: { id: true, documentNumber: true, heldAt: true },
        orderBy: { heldAt: "asc" },
        take: STALE_QUICK_LIST_SIZE,
      }),
      db.stockTransferMain.count({ where: { storeId, status: "pending" } }),
      db.stockTransferMain.count({ where: { destinationStoreId: storeId, status: "pending" } }),
      db.bill.findMany({
        where: { storeId, billType: "credit_bill", status: "completed" },
        select: { id: true, grandTotal: true },
      }),
      db.product.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          stockTracked: true,
          reorderLevel: { not: null },
        },
        select: { id: true, name: true, systemBarcode: true, reorderLevel: true },
      }),
    ]);

    const billIds = creditBills.map((b) => b.id);
    const [creditNoteSums, paymentSums] = billIds.length
      ? await Promise.all([
          db.creditNote.groupBy({
            by: ["originalBillId"],
            where: { originalBillId: { in: billIds } },
            _sum: { amount: true },
          }),
          db.billPayment.groupBy({
            by: ["billId"],
            where: { billId: { in: billIds }, status: "success" },
            _sum: { amount: true },
          }),
        ])
      : [[], []];
    const creditNotesByBill = new Map(
      creditNoteSums.map((row) => [row.originalBillId, Number(row._sum.amount ?? 0)]),
    );
    const paymentsByBill = new Map(
      paymentSums.map((row) => [row.billId, Number(row._sum.amount ?? 0)]),
    );
    let creditOutstandingTotal = 0;
    let creditOutstandingBillCount = 0;
    for (const bill of creditBills) {
      const outstanding =
        Number(bill.grandTotal) -
        (creditNotesByBill.get(bill.id) ?? 0) -
        (paymentsByBill.get(bill.id) ?? 0);
      if (outstanding > 0.01) {
        creditOutstandingTotal += outstanding;
        creditOutstandingBillCount += 1;
      }
    }

    const lowStockItems: {
      productId: string;
      productName: string;
      available: number;
      reorderLevel: number;
    }[] = [];
    for (const product of lowStockCandidates) {
      let available = 0;
      for (const warehouse of warehouses) {
        const levels = await getStockLevels({ productId: product.id, warehouseId: warehouse.id });
        available += levels.available;
      }
      if (available <= product.reorderLevel!) {
        lowStockItems.push({
          productId: product.id,
          productName: product.name,
          available,
          reorderLevel: product.reorderLevel!,
        });
      }
    }

    const billTypeTotals = { cash_bill: 0, credit_bill: 0, online_bill: 0 };
    const billTypeCounts = { cash_bill: 0, credit_bill: 0, online_bill: 0 };
    for (const row of todaySales) {
      billTypeTotals[row.billType] = Number(row._sum.grandTotal ?? 0);
      billTypeCounts[row.billType] = row._count;
    }

    return Response.json({
      hasStore: true,
      todaySales: {
        byType: billTypeTotals,
        countByType: billTypeCounts,
        totalRevenue: Object.values(billTypeTotals).reduce((a, b) => a + b, 0),
        totalBills: Object.values(billTypeCounts).reduce((a, b) => a + b, 0),
      },
      lowStock: {
        count: lowStockItems.length,
        items: lowStockItems.slice(0, LOW_STOCK_QUICK_LIST_SIZE),
      },
      staleBlocks: { count: staleBlockCount, items: staleBlockItems },
      staleHeldBills: { count: staleHeldCount, items: staleHeldBills },
      pendingTransfers: { incoming: incomingTransfers, outgoing: outgoingTransfers },
      creditOutstanding: { total: creditOutstandingTotal, billCount: creditOutstandingBillCount },
    });
  });
}
