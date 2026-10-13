import { makeDeviceBridge } from "./deviceBridge";
import type { DeviceHardware, HardwareBridge, NativePrinter, PrintBytesRequest } from "./types";

// What the desktop preload exposes. The older shells only had print/
// openCashDrawer/chargeCard, so the transport methods are optional and their
// absence is what tells us we are talking to one of those builds.
export interface ElectronHardware extends HardwareBridge {
  printHtml?(options: { html: string }): Promise<void>;
  printBytes?(options: PrintBytesRequest): Promise<void>;
  listPrinters?(options: { transport: string }): Promise<{ printers: NativePrinter[] }>;
}

export function getElectronHardware(): ElectronHardware | null {
  if (typeof window === "undefined") return null;
  return (window.hardware as ElectronHardware | undefined) ?? null;
}

export function getElectronDeviceHardware(): DeviceHardware | null {
  const hardware = getElectronHardware();
  if (!hardware?.printBytes || !hardware.printHtml || !hardware.listPrinters) return null;
  const { printHtml, printBytes, listPrinters } = hardware;
  return {
    print: (options) => printHtml.call(hardware, options),
    printBytes: (options) => printBytes.call(hardware, options),
    listPrinters: (options) => listPrinters.call(hardware, options),
  };
}

export function getElectronPrintBridge(): HardwareBridge | null {
  const hardware = getElectronHardware();
  if (!hardware) return null;

  const device = getElectronDeviceHardware();
  // A desktop build from before per-device printer settings: it owns the
  // routing itself, so pass the payload straight through rather than
  // encoding bytes it has no handler for.
  if (!device) return hardware;

  const bridge = makeDeviceBridge(device);
  return hardware.chargeCard
    ? { ...bridge, chargeCard: hardware.chargeCard.bind(hardware) }
    : bridge;
}
