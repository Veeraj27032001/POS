export type PrinterTransport = "system" | "bluetooth" | "usb" | "network";

export interface PrinterConfig {
  /** "system" hands the document to Android's own print dialog. */
  transport: PrinterTransport;
  /** Bluetooth MAC, USB device name, or network host. Unused by "system". */
  address: string;
  /** Network printers only; 9100 is the ESC/POS convention. */
  port?: number;
  paperWidth: 58 | 80;
  name?: string;
}

// A printer belongs to the device it is plugged into, not to the store, so the
// choice is kept locally rather than on the Terminal record. Two tablets on the
// same counter can have different hardware.
const STORAGE_KEY = "pos:printer-config";

// Android's own dialog lists every system printer and Save as PDF, so it is the
// default for a till nobody has set up yet.
export const SYSTEM_PRINTER: PrinterConfig = {
  transport: "system",
  address: "",
  paperWidth: 58,
};

export function readPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return SYSTEM_PRINTER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SYSTEM_PRINTER;
    const parsed = JSON.parse(raw) as Partial<PrinterConfig>;
    // A direct transport with no target cannot print; the dialog always can.
    if (!parsed.transport || parsed.transport === "system" || !parsed.address) {
      return SYSTEM_PRINTER;
    }
    return {
      transport: parsed.transport,
      address: parsed.address,
      port: parsed.port,
      paperWidth: parsed.paperWidth === 80 ? 80 : 58,
      name: parsed.name,
    };
  } catch {
    return SYSTEM_PRINTER;
  }
}

export function writePrinterConfig(config: PrinterConfig | null): void {
  if (typeof window === "undefined") return;
  try {
    if (config && config.transport !== "system") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // A locked-down browser profile just means no saved printer.
  }
}
