// Temp identifier for a bill that hasn't been created yet — draft or held,
// never the real cash_bill/credit_bill series (that's only allocated at
// Create bill). Mirrors the real format's prefix/FY/number shape, e.g.
// DRFT-CASH/2027-28/001 — same number and financial year throughout, only
// the status prefix (DRFT/HD) changes.
export function formatTempBillNumber(
  billType: "cash_bill" | "credit_bill",
  number: number,
  status: "draft" | "held",
  financialYearLabel: string,
): string {
  const typeCode = billType === "cash_bill" ? "CASH" : "CRED";
  const statusPrefix = status === "held" ? "HD" : "DRFT";
  return `${statusPrefix}-${typeCode}/${financialYearLabel}/${String(number).padStart(3, "0")}`;
}

export function swapTempBillNumberPrefix(documentNumber: string, status: "draft" | "held"): string {
  const statusPrefix = status === "held" ? "HD" : "DRFT";
  return documentNumber.replace(/^(DRFT|HD)-/, `${statusPrefix}-`);
}
