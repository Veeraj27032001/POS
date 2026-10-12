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
      const bytes = config ? escPosFor(payload, config) : null;

      // A configured thermal printer takes receipts and labels directly, with
      // no dialog. Store-authored page layouts can't be expressed as ESC/POS,
      // and an unconfigured device has nowhere to send bytes — both fall back
      // to Android's print dialog so printing still works.
      if (config && bytes) {
        await sendBytes(plugin, config, bytes);
        return;
      }
      await plugin.print({ html: htmlFor(payload) });
    },

    async openCashDrawer(): Promise<void> {
      const config = readPrinterConfig();
      if (!config) throw new Error("No printer is set up on this device.");
      await sendBytes(plugin, config, encodeCashDrawerKick());
    },
  };
}
