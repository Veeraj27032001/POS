import { getPrintBridge } from "@/lib/adapters/print";

interface PrintableBillLine {
  productName: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
}

interface PrintableReceiptBill {
  id: string;
  documentNumber: string;
  subtotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  grandTotal: string | number;
  receiptSnapshot: {
    storeName: string;
    headerText: string | null;
    footerText: string | null;
    returnPolicyText: string | null;
  } | null;
  lines: PrintableBillLine[];
}

async function fetchFormattedHtml(
  billId: string,
  type: "receipt" | "bill",
): Promise<string | null> {
  const res = await fetch(`/api/bills/${billId}/print?type=${type}`);
  if (!res.ok) return null;
  const { html } = (await res.json()) as { html: string | null };
  return html;
}

async function printFallbackReceipt(bill: PrintableReceiptBill): Promise<void> {
  const snapshot = bill.receiptSnapshot;
  await getPrintBridge().print({
    kind: "receipt",
    storeName: snapshot?.storeName ?? "",
    headerText: snapshot?.headerText ?? undefined,
    footerText: snapshot?.footerText ?? undefined,
    returnPolicyText: snapshot?.returnPolicyText ?? undefined,
    documentNumber: bill.documentNumber,
    lines: bill.lines.map((l) => ({
      name: l.productName,
      quantity: l.quantity,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
    subtotal: Number(bill.subtotal),
    discountTotal: Number(bill.discountTotal),
    taxTotal: Number(bill.taxTotal),
    grandTotal: Number(bill.grandTotal),
  });
}

export async function printReceipt(bill: PrintableReceiptBill): Promise<void> {
  const html = await fetchFormattedHtml(bill.id, "receipt");
  if (html) {
    await getPrintBridge().print({ kind: "html", html });
    return;
  }
  await printFallbackReceipt(bill);
}

export async function printBill(billId: string): Promise<void> {
  const html = await fetchFormattedHtml(billId, "bill");
  if (!html) {
    throw new Error(
      "No bill format is configured for this store and bill type yet — set one up under Bill Formats.",
    );
  }
  await getPrintBridge().print({ kind: "html", html });
}

async function printDocument(url: string, missingFormatMessage: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to load the print format.");
  }
  const { html } = (await res.json()) as { html: string | null };
  if (!html) {
    throw new Error(missingFormatMessage);
  }
  await getPrintBridge().print({ kind: "html", html });
}

export async function printCreditNote(creditNoteId: string): Promise<void> {
  await printDocument(
    `/api/credit-notes/${creditNoteId}/print`,
    "No credit note format is configured for this store and bill type yet — set one up under Bill Formats.",
  );
}

export async function printRefund(refundId: string): Promise<void> {
  await printDocument(
    `/api/refunds/${refundId}/print`,
    "No refund format is configured for this store and bill type yet — set one up under Bill Formats.",
  );
}
