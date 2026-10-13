import { renderLabelHtml, renderReceiptHtml } from "./browser";
import { encodeCashDrawerKick, encodeLabels, encodeReceipt, toBase64 } from "./escpos";
import { readPrinterConfig, type PrinterConfig } from "./printerConfig";
import type { HardwareBridge, PrintPayload } from "./types";

export interface NativePrinter {
  name: string;
  address: string;
}

// Typed here rather than imported from @capacitor/core: the web app must not
// depend on a package only the Android shell installs.
export interface CapacitorHardwarePlugin {
  print(options: { html: string }): Promise<void>;
  printBytes(options: {
    transport: string;
    address: string;
    port?: number;
    data: string;
  }): Promise<void>;
  listPrinters(options: { transport: string }): Promise<{ printers: NativePrinter[] }>;
}

declare global {
  interface Window {
    Capacitor?: {
      Plugins?: { Hardware?: CapacitorHardwarePlugin };
    };
  }
}

export function getHardwarePlugin(): CapacitorHardwarePlugin | null {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.Hardware ?? null;
}

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

async function sendBytes(
  plugin: CapacitorHardwarePlugin,
  config: PrinterConfig,
  bytes: Uint8Array,
): Promise<void> {
  await plugin.printBytes({
    transport: config.transport,
    address: config.address,
    port: config.port,
    data: toBase64(bytes),
  });
}

export function getCapacitorPrintBridge(): HardwareBridge | null {
  const plugin = getHardwarePlugin();
  if (!plugin) return null;

  return {
    async print(payload: PrintPayload): Promise<void> {
      const config = readPrinterConfig();
      const bytes = config.transport === "system" ? null : escPosFor(payload, config);

      // Android's print dialog handles anything we cannot send as ESC/POS:
      // page layouts, tills set to the system printer, and a configured
      // printer that is switched off or out of range. It also offers Save as
      // PDF and every system printer, so printing never dead-ends.
      if (!bytes) {
        await plugin.print({ html: htmlFor(payload) });
        return;
      }

      try {
        await sendBytes(plugin, config, bytes);
      } catch {
        await plugin.print({ html: htmlFor(payload) });
      }
    },

    async openCashDrawer(): Promise<void> {
      const config = readPrinterConfig();
      // The kick pulse only exists as printer bytes, so there is no dialog to
      // fall back to here.
      if (config.transport === "system") {
        throw new Error("Set up the till printer on Settings > Printer to open the drawer.");
      }
      await sendBytes(plugin, config, encodeCashDrawerKick());
    },
  };
}
