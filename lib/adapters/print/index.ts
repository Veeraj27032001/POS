import { browserPrintBridge } from "./browser";
import type { HardwareBridge } from "./types";

export type {
  HardwareBridge,
  LabelPrintItem,
  LabelPrintPayload,
  PrintPayload,
  ReceiptPrintPayload,
} from "./types";

export function getPrintBridge(): HardwareBridge {
  if (typeof window !== "undefined" && window.hardware) {
    return window.hardware;
  }
  return browserPrintBridge;
}
