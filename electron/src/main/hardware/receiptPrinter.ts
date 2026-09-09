import type { ThermalPrinter } from "node-thermal-printer";

import type { ReceiptPrintPayload } from "../../../../lib/adapters/print/types";

function money(n: number): string {
  return n.toFixed(2);
}

export async function printReceipt(
  printer: ThermalPrinter,
  payload: ReceiptPrintPayload,
): Promise<void> {
  printer.clear();
  printer.alignCenter();
  printer.bold(true);
  printer.println(payload.storeName);
  printer.bold(false);
  if (payload.headerText) printer.println(payload.headerText);
  printer.drawLine();
  printer.alignLeft();
  printer.println(payload.documentNumber);
  printer.newLine();

  for (const line of payload.lines) {
    printer.println(line.name);
    printer.leftRight(`  ${line.quantity} x ${money(line.unitPrice)}`, money(line.lineTotal));
  }
  printer.drawLine();

  printer.leftRight("Subtotal", money(payload.subtotal));
  printer.leftRight("Discount", money(payload.discountTotal));
  printer.leftRight("Tax", money(payload.taxTotal));
  printer.bold(true);
  printer.leftRight("Total", money(payload.grandTotal));
  printer.bold(false);

  if (payload.footerText) {
    printer.drawLine();
    printer.alignCenter();
    printer.println(payload.footerText);
  }
  if (payload.returnPolicyText) {
    printer.alignCenter();
    printer.println(payload.returnPolicyText);
  }

  printer.cut();
  await printer.execute();
}
