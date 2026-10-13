import { makeDeviceBridge } from "./deviceBridge";
import type { DeviceHardware, HardwareBridge, NativePrinter } from "./types";

export type { NativePrinter };

// Typed as the shared DeviceHardware rather than imported from @capacitor/core:
// the web app must not depend on a package only the Android shell installs.
export type CapacitorHardwarePlugin = DeviceHardware;

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

export function getCapacitorPrintBridge(): HardwareBridge | null {
  const plugin = getHardwarePlugin();
  return plugin ? makeDeviceBridge(plugin) : null;
}
