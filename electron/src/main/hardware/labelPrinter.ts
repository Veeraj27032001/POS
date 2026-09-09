import type { ThermalPrinter } from "node-thermal-printer";

import type { LabelPrintPayload } from "../../../../lib/adapters/print/types";

export async function printLabels(
  printer: ThermalPrinter,
  payload: LabelPrintPayload,
): Promise<void> {
  printer.clear();

  for (const item of payload.labels) {
    for (let copy = 0; copy < item.copies; copy++) {
      printer.alignCenter();
      printer.bold(true);
      printer.println(item.productName);
      printer.bold(false);
      printer.println(`Rs. ${item.price.toFixed(2)}`);
      printer.code128(item.barcodeValue, { width: "MEDIUM", height: 40, text: 1 });
      printer.newLine();
    }
  }

  printer.cut();
  await printer.execute();
}
