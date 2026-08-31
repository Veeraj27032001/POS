// Temp identifier for a bill that hasn't been created yet — draft or held,
// never the real cash_bill/credit_bill series (that's only allocated at
// Create bill). Same number throughout, prefix swaps with status.
export function formatTempBillNumber(
  billType: "cash_bill" | "credit_bill",
  number: number,
  status: "draft" | "held",
): string {
  const typeCode = billType === "cash_bill" ? "CASH" : "CRED";
  const statusPrefix = status === "held" ? "HD" : "DRFT";
  return `${statusPrefix}-${typeCode}-${String(number).padStart(3, "0")}`;
}

export function swapTempBillNumberPrefix(documentNumber: string, status: "draft" | "held"): string {
  const statusPrefix = status === "held" ? "HD" : "DRFT";
  const rest = documentNumber.replace(/^(DRFT|HD)-/, "");
  return `${statusPrefix}-${rest}`;
}
