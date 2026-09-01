import { unscoped } from "@/lib/db";

export interface ShiftClosingExpected {
  openingFloat: number;
  cashSales: number;
  cashRefunds: number;
  closingExpected: number;
}

export async function getShiftClosingExpected(shiftId: string): Promise<ShiftClosingExpected> {
  const db = unscoped();

  const shift = await db.shift.findUniqueOrThrow({
    where: { id: shiftId },
    select: { openingFloat: true },
  });

  const cashSalesAgg = await db.billPayment.aggregate({
    _sum: { amount: true },
    where: { status: "success", paymentMethod: { type: "cash" }, bill: { shiftId } },
  });
  const cashSales = Number(cashSalesAgg._sum.amount ?? 0);

  const [returns, cancellations] = await Promise.all([
    db.billReturn.findMany({ where: { bill: { shiftId } }, select: { id: true } }),
    db.billCancellation.findMany({ where: { bill: { shiftId } }, select: { id: true } }),
  ]);
  const returnIds = returns.map((r) => r.id);
  const cancellationIds = cancellations.map((c) => c.id);

  const refundsAgg =
    returnIds.length > 0 || cancellationIds.length > 0
      ? await db.refund.aggregate({
          _sum: { amount: true },
          where: {
            status: "completed",
            refundMethod: { type: "cash" },
            OR: [
              { sourceType: "bill_return", sourceId: { in: returnIds } },
              { sourceType: "bill_cancellation", sourceId: { in: cancellationIds } },
            ],
          },
        })
      : null;
  const cashRefunds = Number(refundsAgg?._sum.amount ?? 0);

  const openingFloat = Number(shift.openingFloat);
  return {
    openingFloat,
    cashSales,
    cashRefunds,
    closingExpected: openingFloat + cashSales - cashRefunds,
  };
}
