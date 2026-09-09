import { ipcMain } from "electron";

import type { loadConfig } from "../config";

import type {
  CardChargeContext,
  CardChargeResult,
  PrintPayload,
} from "../../../../lib/adapters/print/types";

type ElectronConfig = ReturnType<typeof loadConfig>;

// Registered once at startup. hardware:print dispatches by payload.kind —
// receipt/label build ESC/POS commands, html goes through Chromium's own
// print pipeline (a store-authored Bill Format has no paper-size field and
// can't be reinterpreted as thermal text). Real printer wiring lands in a
// later step; for now every kind shares the same "no hardware configured"
// path, which is genuinely correct default behavior for PRINTER_TRANSPORT
// "none", not just a placeholder — it's the only path that would ever
// fire for anyone who hasn't set up a printer at all.
export function registerHardwareIpc(config: ElectronConfig): void {
  ipcMain.handle("hardware:print", async (_event, payload: PrintPayload) => {
    logJobPreview(payload);
    if (config.PRINTER_TRANSPORT === "none") {
      throw new Error("No receipt printer configured for this terminal.");
    }
    throw new Error(`Printer transport "${config.PRINTER_TRANSPORT}" isn't wired up yet.`);
  });

  ipcMain.handle("hardware:openCashDrawer", async () => {
    if (config.PRINTER_TRANSPORT === "none") {
      throw new Error("No receipt printer configured for this terminal.");
    }
    throw new Error(`Printer transport "${config.PRINTER_TRANSPORT}" isn't wired up yet.`);
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
