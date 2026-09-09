import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";

import type { loadConfig } from "../config";

type ElectronConfig = ReturnType<typeof loadConfig>;

// tcp:// needs no extra native dependency — node-thermal-printer talks to
// it over a plain socket. "windows"/"serial" both require a driver package
// node-thermal-printer only calls via a lazy require() (it isn't a real
// dependency of node-thermal-printer itself, by design — see its README):
// "windows" needs the `printer` package (or `electron-printer`), "serial"
// needs `node-serialport` wired in as a `driver`. Neither is installed here
// yet — building against a native module this build has never actually
// tested compiling would be a worse bet than an honest, clearly-flagged
// gap. Both throw a specific, actionable error instead of silently
// pretending to work.
export function createPrinterConnection(config: ElectronConfig): ThermalPrinter | null {
  switch (config.PRINTER_TRANSPORT) {
    case "none":
      return null;
    case "network":
      if (!config.PRINTER_HOST) {
        throw new Error("PRINTER_TRANSPORT=network requires PRINTER_HOST to be set.");
      }
      return new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${config.PRINTER_HOST}:${config.PRINTER_PORT ?? 9100}`,
        width: 42,
      });
    case "windows":
      if (!config.PRINTER_WINDOWS_NAME) {
        throw new Error("PRINTER_TRANSPORT=windows requires PRINTER_WINDOWS_NAME to be set.");
      }
      try {
        return new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: `printer:${config.PRINTER_WINDOWS_NAME}`,
          width: 42,
        });
      } catch (err) {
        throw new Error(
          `PRINTER_TRANSPORT=windows requires the "printer" package to be installed separately ` +
            `(pnpm add printer, inside electron/) — node-thermal-printer resolves it lazily and ` +
            `it isn't one of this build's own dependencies yet. Original error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    case "serial":
      throw new Error(
        "PRINTER_TRANSPORT=serial isn't wired up yet — it needs node-serialport passed in as an " +
          "explicit driver, which this build doesn't install. Use network or windows for now.",
      );
    default:
      return null;
  }
}
