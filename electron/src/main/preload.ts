import { contextBridge, ipcRenderer } from "electron";

// Typed against the real interface the web app already imports and calls
// getPrintBridge() against — if a method is added to HardwareBridge and
// forgotten here, this is a compile error, not a runtime surprise a
// cashier discovers mid-sale.
import type {
  CardChargeContext,
  CardChargeResult,
  HardwareBridge,
  PrintPayload,
} from "../../../lib/adapters/print/types";

const hardware: HardwareBridge = {
  print: (payload: PrintPayload) => ipcRenderer.invoke("hardware:print", payload),
  openCashDrawer: () => ipcRenderer.invoke("hardware:openCashDrawer"),
  chargeCard: (amount: number, context: CardChargeContext): Promise<CardChargeResult> =>
    ipcRenderer.invoke("hardware:chargeCard", amount, context),
};

contextBridge.exposeInMainWorld("hardware", hardware);
