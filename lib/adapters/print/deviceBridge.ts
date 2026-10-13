import { renderLabelHtml, renderReceiptHtml } from "./browser";
import { encodeCashDrawerKick, encodeLabels, encodeReceipt, toBase64 } from "./escpos";
import { readPrinterConfig, type PrinterConfig } from "./printerConfig";
import type { DeviceHardware, HardwareBridge, PrintPayload } from "./types";

function htmlFor(payload: PrintPayload): string {
  if (payload.kind === "html") return payload.html;
  if (payload.kind === "receipt") return renderReceiptHtml(payload);
  return renderLabelHtml(payload);
}

function escPosFor(payload: PrintPayload, config: PrinterConfig): Uint8Array | null {
  if (payload.kind === "receipt") return encodeReceipt(payload, config.paperWidth);
  if (payload.kind === "label") return encodeLabels(payload, config.paperWidth);
  return null;
}

function sendBytes(
  hardware: DeviceHardware,
  config: PrinterConfig,
  bytes: Uint8Array,
): Promise<void> {
  return hardware.printBytes({
    transport: config.transport,
    address: config.address,
    port: config.port,
    data: toBase64(bytes),
  });
}

// Shared by the desktop and Android shells. Both encode here and hand the
// native side nothing but bytes and a transport, so receipt formatting has one
// implementation rather than one per platform.
export function makeDeviceBridge(hardware: DeviceHardware): HardwareBridge {
  return {
    async print(payload: PrintPayload): Promise<void> {
      const config = readPrinterConfig();
      const bytes = config.transport === "system" ? null : escPosFor(payload, config);

      // The system print dialog handles everything we cannot send as ESC/POS:
      // store-authored page layouts, tills left on the system printer, and a
      // configured printer that is switched off or out of range. Printing
      // never dead-ends on a missing printer.
      if (!bytes) {
        await hardware.print({ html: htmlFor(payload) });
        return;
      }

      try {
        await sendBytes(hardware, config, bytes);
      } catch {
        await hardware.print({ html: htmlFor(payload) });
      }
    },

    async openCashDrawer(): Promise<void> {
      const config = readPrinterConfig();
      // The kick pulse only exists as printer bytes, so there is no dialog to
      // fall back to here.
      if (config.transport === "system") {
        throw new Error("Set up the till printer on Settings > Printer to open the drawer.");
      }
      await sendBytes(hardware, config, encodeCashDrawerKick());
    },
  };
}
