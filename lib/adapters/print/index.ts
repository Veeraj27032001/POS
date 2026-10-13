import { browserPrintBridge } from "./browser";
import { getCapacitorPrintBridge } from "./capacitor";
import { getElectronPrintBridge } from "./electron";
import type { HardwareBridge } from "./types";

export type {
  HardwareBridge,
  LabelPrintItem,
  LabelPrintPayload,
  NativePrinter,
  PrintPayload,
  ReceiptPrintPayload,
} from "./types";

export function getPrintBridge(): HardwareBridge {
  // Electron injects window.hardware through its preload script.
  const electronBridge = getElectronPrintBridge();
  if (electronBridge) return electronBridge;

  // The Android shell can't inject a global into a remotely-loaded page, so it
  // exposes the same capability as a Capacitor plugin instead.
  const capacitorBridge = getCapacitorPrintBridge();
  if (capacitorBridge) return capacitorBridge;

  return browserPrintBridge;
}
