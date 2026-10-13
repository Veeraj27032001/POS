import { ipcMain } from "electron";

import type { loadConfig } from "../config";
import { printHtml } from "../hardware/htmlPrinter";
import { writeNetworkPrinter } from "../hardware/networkPrinter";
import { listSerialPorts, writeSerialPrinter } from "../hardware/serialPrinter";
import { listWindowsPrinters, writeWindowsPrinter } from "../hardware/windowsPrinter";

import type {
  CardChargeContext,
  CardChargeResult,
  NativePrinter,
  PrintBytesRequest,
  PrintPayload,
} from "../../../../lib/adapters/print/types";

type ElectronConfig = ReturnType<typeof loadConfig>;

// The renderer owns printer choice and ESC/POS encoding; this side only knows
// how to move bytes down a transport. That is what lets the desktop app and
// the Android app share one receipt format instead of two that drift.
export function registerHardwareIpc(config: ElectronConfig): void {
  ipcMain.handle("hardware:printHtml", async (_event, options: { html: string }) => {
    await printHtml(options.html, config);
  });

  ipcMain.handle("hardware:printBytes", async (_event, request: PrintBytesRequest) => {
    const bytes = Buffer.from(request.data, "base64");
    switch (request.transport) {
      case "network":
        await writeNetworkPrinter(request.address, request.port ?? 9100, bytes);
        return;
      case "serial":
        await writeSerialPrinter(request.address, bytes);
        return;
      case "windows":
        await writeWindowsPrinter(request.address, bytes);
        return;
      default:
        throw new Error(`This computer cannot print over ${request.transport}.`);
    }
  });

  ipcMain.handle(
    "hardware:listPrinters",
    async (_event, options: { transport: string }): Promise<{ printers: NativePrinter[] }> => {
      const names =
        options.transport === "serial" ? await listSerialPorts() : await listWindowsPrinters();
      return { printers: names.map((name) => ({ name, address: name })) };
    },
  );

  // Kept for desktop builds whose renderer predates per-device printer
  // settings: those send a whole payload and expect this side to route it.
  ipcMain.handle("hardware:print", async (_event, payload: PrintPayload) => {
    if (payload.kind !== "html") {
      throw new Error("This version of the app needs the printer set up under Settings > Printer.");
    }
    await printHtml(payload.html, config);
  });

  ipcMain.handle("hardware:openCashDrawer", async () => {
    throw new Error("Set up the till printer under Settings > Printer to open the drawer.");
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
