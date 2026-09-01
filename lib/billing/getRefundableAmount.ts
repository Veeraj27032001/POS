import { unscoped } from "@/lib/db";

export async function getRefundableAmount(billId: string): Promise<number> {
  const db = unscoped();

  const [paidAgg, returns, cancellations] = await Promise.all([
    db.billPayment.aggregate({
      _sum: { amount: true },
      where: { billId, status: "success" },
    }),
    db.billReturn.findMany({ where: { billId }, select: { id: true } }),
    db.billCancellation.findMany({ where: { billId }, select: { id: true } }),
  ]);

  const sourceIds = [...returns.map((r) => r.id), ...cancellations.map((c) => c.id)];
  const paid = Number(paidAgg._sum.amount ?? 0);
  if (sourceIds.length === 0) return Math.max(0, paid);

  const refundedAgg = await db.refund.aggregate({
    _sum: { amount: true },
    where: { sourceId: { in: sourceIds }, status: { in: ["pending", "processing", "completed"] } },
  });
  const alreadyRefunded = Number(refundedAgg._sum.amount ?? 0);

  return Math.max(0, paid - alreadyRefunded);
}
