import { unscoped } from "@/lib/db";

export interface TaxBreakdown {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const ZERO_TAX: TaxBreakdown = {
  cgstRate: 0,
  sgstRate: 0,
  igstRate: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  taxAmount: 0,
};

// Resolves a bill line's tax. Per the "Future billing note" recorded when
// the HSN Code engine was built: tax only applies once the selling store's
// TaxEngine.code is "india_standard" — a store starts with no engine
// selected, and CGST/SGST/IGST are specifically an India-GST concept, not a
// generic default. No engine (or a future non-India engine), no HSN on the
// product, or the display preference off — all mean zero tax, not a hard
// error, matching the looser convention already established for HSN Code.
export async function resolveTax(params: {
  productId: string;
  lineSubtotal: number;
  storeTaxEngineCode: string | null;
  storeStateId: string | null;
  customerStateId: string | null;
  excludeTax: boolean;
}): Promise<TaxBreakdown> {
  if (params.excludeTax) {
    return ZERO_TAX;
  }

  if (params.storeTaxEngineCode === "india_standard") {
    return resolveIndiaGst(params);
  }

  return ZERO_TAX;
}

async function resolveIndiaGst(params: {
  productId: string;
  lineSubtotal: number;
  storeStateId: string | null;
  customerStateId: string | null;
}): Promise<TaxBreakdown> {
  const db = unscoped();
  const [preferences, product] = await Promise.all([
    db.taxPreferences.findFirst(),
    db.product.findUnique({ where: { id: params.productId }, include: { hsnCode: true } }),
  ]);

  if (!preferences?.hsnTaxDisplayEnabled || !product?.hsnCode) {
    return ZERO_TAX;
  }

  const hsn = product.hsnCode;

  const interState =
    params.storeStateId !== null &&
    params.customerStateId !== null &&
    params.storeStateId !== params.customerStateId;

  if (interState) {
    const igstRate = Number(hsn.igstRate);
    const igstAmount = round2((params.lineSubtotal * igstRate) / 100);
    return { ...ZERO_TAX, igstRate, igstAmount, taxAmount: igstAmount };
  }

  const cgstRate = Number(hsn.cgstRate);
  const sgstRate = Number(hsn.sgstRate);
  const cgstAmount = round2((params.lineSubtotal * cgstRate) / 100);
  const sgstAmount = round2((params.lineSubtotal * sgstRate) / 100);
  return {
    ...ZERO_TAX,
    cgstRate,
    sgstRate,
    cgstAmount,
    sgstAmount,
    taxAmount: cgstAmount + sgstAmount,
  };
}
