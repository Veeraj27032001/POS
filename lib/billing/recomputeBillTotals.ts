import type { Prisma } from "@/generated/prisma/client";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// The one place a bill's header totals are derived from its active lines —
// called after any line add/quantity-change/void/discount so the header
// never drifts out of sync with what's actually on the bill.
export async function recomputeBillTotals(tx: Prisma.TransactionClient, billId: string) {
  const lines = await tx.billLine.findMany({ where: { billId, status: "active" } });

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    subtotal += Number(line.unitPrice) * line.quantity;
    discountTotal += Number(line.discountApplied ?? 0);
    const breakdown = line.taxBreakdown as { taxAmount?: number } | null;
    taxTotal += Number(breakdown?.taxAmount ?? 0);
  }
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
