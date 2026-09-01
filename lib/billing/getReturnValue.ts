import { unscoped } from "@/lib/db";
import type { TaxBreakdown } from "@/lib/billing/resolveTax";
import { ZERO_TAX } from "@/lib/billing/resolveTax";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function scaleTax(tax: TaxBreakdown, ratio: number): TaxBreakdown {
  return {
    cgstRate: tax.cgstRate,
    sgstRate: tax.sgstRate,
    igstRate: tax.igstRate,
    cgstAmount: round2(tax.cgstAmount * ratio),
    sgstAmount: round2(tax.sgstAmount * ratio),
    igstAmount: round2(tax.igstAmount * ratio),
    taxAmount: round2(tax.taxAmount * ratio),
  };
}

export async function getReturnValue(
  returnId: string,
): Promise<{ amount: number; taxBreakdown: TaxBreakdown }> {
  const db = unscoped();

  const billReturn = await db.billReturn.findUniqueOrThrow({
    where: { id: returnId },
    include: { lines: { include: { billLine: true } } },
  });

  const billLineTotals = await db.billLine.aggregate({
    _sum: { lineTotal: true },
    where: { billId: billReturn.billId, status: "active" },
  });
  const billLineTotalSum = Number(billLineTotals._sum.lineTotal ?? 0);

  const bill = await db.bill.findUniqueOrThrow({
    where: { id: billReturn.billId },
    select: { overallDiscount: true },
  });
  const overallDiscount = Number(bill.overallDiscount);

  let rawTotal = 0;
  let taxBreakdown: TaxBreakdown = { ...ZERO_TAX };

  for (const line of billReturn.lines) {
    const ratio = line.quantity / line.billLine.quantity;
    const lineValue = round2(Number(line.billLine.lineTotal) * ratio);
    rawTotal += lineValue;

    const lineTax = line.billLine.taxBreakdown as unknown as TaxBreakdown;
    const scaled = scaleTax(lineTax, ratio);
    taxBreakdown = {
      cgstRate: lineTax.cgstRate,
      sgstRate: lineTax.sgstRate,
      igstRate: lineTax.igstRate,
      cgstAmount: round2(taxBreakdown.cgstAmount + scaled.cgstAmount),
      sgstAmount: round2(taxBreakdown.sgstAmount + scaled.sgstAmount),
      igstAmount: round2(taxBreakdown.igstAmount + scaled.igstAmount),
      taxAmount: round2(taxBreakdown.taxAmount + scaled.taxAmount),
    };
  }

  const allocatedOverallDiscount =
    billLineTotalSum > 0 ? round2((overallDiscount * rawTotal) / billLineTotalSum) : 0;

  return {
    amount: round2(rawTotal - allocatedOverallDiscount),
    taxBreakdown,
  };
}
