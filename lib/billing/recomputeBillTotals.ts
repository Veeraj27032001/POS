import type { Prisma } from "@/generated/prisma/client";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// The one place a bill's header totals are derived — called after any line
// add/quantity-change/void/discount, or after the whole-bill discount
// changes, so the header never drifts out of sync. discountTotal is the sum
// of each line's own discount PLUS the separate whole-bill discount
// (Bill.overallDiscount) — the two are independent figures, not one folded
// into the other.
export async function recomputeBillTotals(tx: Prisma.TransactionClient, billId: string) {
  const [bill, lines] = await Promise.all([
    tx.bill.findUnique({ where: { id: billId }, select: { overallDiscount: true } }),
    tx.billLine.findMany({ where: { billId, status: "active" } }),
  ]);

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    subtotal += Number(line.unitPrice) * line.quantity;
    lineDiscountTotal += Number(line.discountApplied ?? 0);
    const breakdown = line.taxBreakdown as { taxAmount?: number } | null;
    taxTotal += Number(breakdown?.taxAmount ?? 0);
  }
  const overallDiscount = Number(bill?.overallDiscount ?? 0);
  const discountTotal = lineDiscountTotal + overallDiscount;
  const grandTotal = subtotal - discountTotal + taxTotal;

  return tx.bill.update({
    where: { id: billId },
    data: {
      subtotal: round2(subtotal),
      discountTotal: round2(discountTotal),
      taxTotal: round2(taxTotal),
      grandTotal: round2(grandTotal),
    },
  });
}
