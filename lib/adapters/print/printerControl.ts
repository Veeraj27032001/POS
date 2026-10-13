import { getHardwarePlugin } from "./capacitor";
import { getElectronDeviceHardware } from "./electron";
import type { PrinterTransport } from "./printerConfig";
import type { DeviceHardware } from "./types";

export interface TransportOption {
  value: PrinterTransport;
  label: string;
  hint: string;
  /** Transports whose target is typed in rather than discovered. */
  manual?: boolean;
}

export interface PrinterControl {
  platform: "android" | "desktop";
  hardware: DeviceHardware;
  transports: TransportOption[];
}

const SYSTEM_ANDROID: TransportOption = {
  value: "system",
  label: "Android printing (default)",
  hint: "Opens Android's print dialog: any system printer, or Save as PDF.",
};

const SYSTEM_DESKTOP: TransportOption = {
  value: "system",
  label: "Windows printing (default)",
  hint: "Opens the Windows print dialog: any installed printer, or Print to PDF.",
};

const NETWORK: TransportOption = {
  value: "network",
  label: "Wi-Fi / network",
  hint: "The printer's IP address on the shop network.",
  manual: true,
};

const ANDROID_TRANSPORTS: TransportOption[] = [
  SYSTEM_ANDROID,
  { value: "bluetooth", label: "Bluetooth", hint: "Pair the printer in Android settings first." },
  { value: "usb", label: "USB", hint: "Connect the printer and allow access when prompted." },
  NETWORK,
];

const DESKTOP_TRANSPORTS: TransportOption[] = [
  SYSTEM_DESKTOP,
  {
    value: "windows",
    label: "USB / Bluetooth printer",
    hint: "Any thermal printer installed in Windows. Pair a Bluetooth printer in Windows settings first, then pick it here.",
  },
  {
    value: "serial",
    label: "Serial / COM port",
    hint: "For printers on a COM port, including Bluetooth printers paired as a serial port.",
  },
  NETWORK,
];

// The settings screen talks to whichever shell it is running inside through
// this, so one page configures the printer on both desktop and Android.
export function getPrinterControl(): PrinterControl | null {
  const desktop = getElectronDeviceHardware();
  if (desktop) return { platform: "desktop", hardware: desktop, transports: DESKTOP_TRANSPORTS };

  const android = getHardwarePlugin();
  if (android) return { platform: "android", hardware: android, transports: ANDROID_TRANSPORTS };

  return null;
}
