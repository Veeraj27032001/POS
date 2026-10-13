import { contextBridge, ipcRenderer } from "electron";

// Typed against the real interfaces the web app already imports and calls
// getPrintBridge() against — if a method is added and forgotten here, this is
// a compile error, not a runtime surprise a cashier discovers mid-sale.
import type {
  CardChargeContext,
  CardChargeResult,
  HardwareBridge,
  NativePrinter,
  PrintBytesRequest,
  PrintPayload,
} from "../../../lib/adapters/print/types";

// print/openCashDrawer/chargeCard are what older renderers call; printHtml,
// printBytes and listPrinters are what tells a newer renderer that this shell
// can drive a thermal printer itself.
const hardware: HardwareBridge & {
  printHtml(options: { html: string }): Promise<void>;
  printBytes(options: PrintBytesRequest): Promise<void>;
  listPrinters(options: { transport: string }): Promise<{ printers: NativePrinter[] }>;
} = {
  print: (payload: PrintPayload) => ipcRenderer.invoke("hardware:print", payload),
  printHtml: (options: { html: string }) => ipcRenderer.invoke("hardware:printHtml", options),
  printBytes: (options: PrintBytesRequest) => ipcRenderer.invoke("hardware:printBytes", options),
  listPrinters: (options: { transport: string }) =>
    ipcRenderer.invoke("hardware:listPrinters", options),
  openCashDrawer: () => ipcRenderer.invoke("hardware:openCashDrawer"),
  chargeCard: (amount: number, context: CardChargeContext): Promise<CardChargeResult> =>
    ipcRenderer.invoke("hardware:chargeCard", amount, context),
};

contextBridge.exposeInMainWorld("hardware", hardware);
