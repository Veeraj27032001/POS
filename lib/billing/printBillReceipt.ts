import { getPrintBridge } from "@/lib/adapters/print";

interface PrintableBillLine {
  productName: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
}

interface PrintableBill {
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

function openAndPrintHtml(html: string): void {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) throw new Error("Print window was blocked by the browser's popup blocker.");
  win.document.write(html);
  win.document.write("<script>window.onload = () => window.print();<\/script>");
  win.document.close();
}

export async function printBillReceipt(bill: PrintableBill): Promise<void> {
  const formatRes = await fetch(`/api/bills/${bill.id}/print`);
  if (formatRes.ok) {
    const { html } = (await formatRes.json()) as { html: string | null };
    if (html) {
      openAndPrintHtml(html);
      return;
    }
  }

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
