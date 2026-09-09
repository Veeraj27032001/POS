import { ipcMain } from "electron";

import type { loadConfig } from "../config";
import { createPrinterConnection } from "../hardware/printerConnection";
import { printReceipt } from "../hardware/receiptPrinter";
import { printLabels } from "../hardware/labelPrinter";
import { printHtml } from "../hardware/htmlPrinter";

import type {
  CardChargeContext,
  CardChargeResult,
  PrintPayload,
} from "../../../../lib/adapters/print/types";

type ElectronConfig = ReturnType<typeof loadConfig>;

// Registered once at startup. hardware:print dispatches by payload.kind —
// receipt/label build ESC/POS commands over the printer connection; html
// goes through Chromium's own print pipeline instead (a store-authored
// Bill Format has no paper-size field and can't be reinterpreted as
// thermal text) — see hardware/htmlPrinter.ts.
export function registerHardwareIpc(config: ElectronConfig): void {
  // Constructed once — a ThermalPrinter instance doesn't open a live
  // connection until execute()/isPrinterConnected() is actually called, so
  // there's no persistent-connection lifecycle to manage here.
  const printer = createPrinterConnection(config);

  ipcMain.handle("hardware:print", async (_event, payload: PrintPayload) => {
    logJobPreview(payload);

    if (payload.kind === "html") {
      await printHtml(payload.html, config);
      return;
    }

    if (!printer) {
      throw new Error("No receipt printer configured for this terminal.");
    }
    if (payload.kind === "receipt") {
      await printReceipt(printer, payload);
    } else {
      await printLabels(printer, payload);
    }
  });

  ipcMain.handle("hardware:openCashDrawer", async () => {
    if (!printer) {
      throw new Error("No receipt printer configured for this terminal.");
    }
    // The buffer isn't auto-cleared after execute() — without this, a
    // drawer kick would silently re-send whatever was left over from the
    // last print job on this same shared printer instance.
    printer.clear();
    printer.openCashDrawer();
    await printer.execute();
  });

  ipcMain.handle(
    "hardware:chargeCard",
    async (_event, _amount: number, _context: CardChargeContext): Promise<CardChargeResult> => ({
      status: "unavailable",
      message:
        "Razorpay POS device SDK isn't integrated in this build — confirm the payment manually once the terminal completes it.",
    }),
  );
}

// A developer with no physical printer attached still gets a legible
// preview of what would have printed, in the electron . console.
function logJobPreview(payload: PrintPayload): void {
  if (payload.kind === "receipt") {
    console.log(
      `[hardware] receipt job: ${payload.documentNumber}, ${payload.lines.length} line(s), total ${payload.grandTotal}`,
    );
  } else if (payload.kind === "label") {
    const totalCopies = payload.labels.reduce((sum, l) => sum + l.copies, 0);
    console.log(
      `[hardware] label job: ${payload.labels.length} product(s), ${totalCopies} label(s) total`,
    );
  } else {
    console.log(`[hardware] html print job: ${payload.html.length} chars`);
  }
}
