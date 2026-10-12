export type PrinterTransport = "bluetooth" | "usb" | "network";

export interface PrinterConfig {
  transport: PrinterTransport;
  /** Bluetooth MAC, USB device name, or network host. */
  address: string;
  /** Network printers only; 9100 is the ESC/POS convention. */
  port?: number;
  paperWidth: 58 | 80;
  name?: string;
}

// A printer belongs to the device it is plugged into, not to the store — two
// tablets on the same counter can have different hardware — so the choice is
// kept locally rather than on the Terminal record.
const STORAGE_KEY = "pos:printer-config";

export function readPrinterConfig(): PrinterConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrinterConfig>;
    if (!parsed.transport || !parsed.address) return null;
    return {
      transport: parsed.transport,
      address: parsed.address,
      port: parsed.port,
      paperWidth: parsed.paperWidth === 80 ? 80 : 58,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export function writePrinterConfig(config: PrinterConfig | null): void {
  if (typeof window === "undefined") return;
  try {
    if (config) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A locked-down browser profile just means no saved printer.
  }
}
