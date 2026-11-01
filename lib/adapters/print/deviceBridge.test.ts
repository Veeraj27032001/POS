import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeDeviceBridge } from "./deviceBridge";
import { writePrinterConfig } from "./printerConfig";
import type { DeviceHardware, ReceiptPrintPayload } from "./types";

vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

// The printer choice lives in localStorage, which is all these tests need of a
// browser — far cheaper than standing up a DOM for it.
const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  },
});

const receipt: ReceiptPrintPayload = {
  kind: "receipt",
  storeName: "Test Store",
  documentNumber: "BILL/STR1/25-26/0001",
  lines: [{ name: "Item", quantity: 1, unitPrice: 10, lineTotal: 10 }],
  subtotal: 10,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 10,
};

function fakeHardware(overrides: Partial<DeviceHardware> = {}): DeviceHardware {
  return {
    print: vi.fn().mockResolvedValue(undefined),
    printBytes: vi.fn().mockResolvedValue(undefined),
    listPrinters: vi.fn().mockResolvedValue({ printers: [] }),
    ...overrides,
  };
}

describe("makeDeviceBridge", () => {
  beforeEach(() => {
    store.clear();
  });

  it("sends a receipt to a configured printer as bytes, not to the dialog", async () => {
    writePrinterConfig({
      transport: "bluetooth",
      address: "00:11:22:33:44:55",
      paperWidth: 58,
    });
    const hardware = fakeHardware();

    await makeDeviceBridge(hardware).print(receipt);

    expect(hardware.printBytes).toHaveBeenCalledOnce();
    expect(hardware.print).not.toHaveBeenCalled();
  });

  it("uses the print dialog when no printer is set up", async () => {
    const hardware = fakeHardware();

    await makeDeviceBridge(hardware).print(receipt);

    expect(hardware.print).toHaveBeenCalledOnce();
    expect(hardware.printBytes).not.toHaveBeenCalled();
  });

  it("falls back to the print dialog when the printer cannot be reached", async () => {
    writePrinterConfig({ transport: "network", address: "10.0.0.9", port: 9100, paperWidth: 80 });
    const hardware = fakeHardware({
      printBytes: vi.fn().mockRejectedValue(new Error("Printer offline")),
    });

    await makeDeviceBridge(hardware).print(receipt);

    expect(hardware.printBytes).toHaveBeenCalledOnce();
    expect(hardware.print).toHaveBeenCalledOnce();
  });

  it("sends a page layout to the dialog even with a thermal printer set up", async () => {
    writePrinterConfig({ transport: "usb", address: "/dev/bus/usb/001/002", paperWidth: 58 });
    const hardware = fakeHardware();

    await makeDeviceBridge(hardware).print({ kind: "html", html: "<p>Bill</p>" });

    expect(hardware.print).toHaveBeenCalledOnce();
    expect(hardware.printBytes).not.toHaveBeenCalled();
  });

  it("refuses to open the drawer with no printer, since there is no dialog for it", async () => {
    const bridge = makeDeviceBridge(fakeHardware());

    await expect(bridge.openCashDrawer?.()).rejects.toThrow(/Settings > Printer/);
  });
});
