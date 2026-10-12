"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHardwarePlugin, type NativePrinter } from "@/lib/adapters/print/capacitor";
import { encodeReceipt, toBase64 } from "@/lib/adapters/print/escpos";
import {
  readPrinterConfig,
  writePrinterConfig,
  type PrinterTransport,
} from "@/lib/adapters/print/printerConfig";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

const TRANSPORTS: { value: PrinterTransport; label: string; hint: string }[] = [
  { value: "bluetooth", label: "Bluetooth", hint: "Pair the printer in Android settings first." },
  { value: "usb", label: "USB", hint: "Connect the printer and allow access when prompted." },
  {
    value: "network",
    label: "Wi-Fi / network",
    hint: "The printer's IP address on the shop network.",
  },
];

export default function PrinterSettingsPage() {
  const plugin = getHardwarePlugin();
  const [transport, setTransport] = useState<PrinterTransport>("bluetooth");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [port, setPort] = useState("9100");
  const [paperWidth, setPaperWidth] = useState<"58" | "80">("58");
  const [found, setFound] = useState<NativePrinter[]>([]);
  const [busy, setBusy] = useState(false);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    const saved = readPrinterConfig();
    if (!saved) return;
    setTransport(saved.transport);
    setAddress(saved.address);
    setName(saved.name ?? "");
    setPort(String(saved.port ?? 9100));
    setPaperWidth(saved.paperWidth === 80 ? "80" : "58");
  }, []);

  async function scan() {
    if (!plugin) return;
    setBusy(true);
    try {
      const result = await plugin.listPrinters({ transport });
      setFound(result.printers);
      if (result.printers.length === 0) {
        toast.error(
          transport === "bluetooth"
            ? "No paired Bluetooth devices. Pair the printer in Android settings first."
            : "No USB devices found. Check the cable.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list printers.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!address.trim()) {
      toast.error("Choose or enter a printer address first.");
      return;
    }
    writePrinterConfig({
      transport,
      address: address.trim(),
      port: transport === "network" ? Number(port) || 9100 : undefined,
      paperWidth: paperWidth === "80" ? 80 : 58,
      name: name || undefined,
    });
    toast.success("Printer saved on this device.");
  }

  async function testPrint() {
    if (!plugin) return;
    if (!address.trim()) {
      toast.error("Choose a printer first.");
      return;
    }
    setBusy(true);
    try {
      const bytes = encodeReceipt(
        {
          kind: "receipt",
          storeName: "Vedix POS",
          headerText: "Printer test",
          documentNumber: new Date().toLocaleString(),
          lines: [{ name: "Test item", quantity: 1, unitPrice: 1, lineTotal: 1 }],
          subtotal: 1,
          discountTotal: 0,
          taxTotal: 0,
          grandTotal: 1,
          footerText: "If you can read this, the printer is set up.",
        },
        paperWidth === "80" ? 80 : 58,
      );
      await plugin.printBytes({
        transport,
        address: address.trim(),
        port: transport === "network" ? Number(port) || 9100 : undefined,
        data: toBase64(bytes),
      });
      toast.success("Sent to the printer.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The printer did not respond.");
    } finally {
      setBusy(false);
    }
  }

  const activeHint = TRANSPORTS.find((t) => t.value === transport)?.hint;

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Printer</h1>
        <p className="text-muted-foreground text-sm">
          Receipt printer for this device. Each till keeps its own setting, so it stays put even
          when another device signs in to the same store.
        </p>
      </div>

      {!plugin ? (
        <Card>
          <CardContent>
            <p className="text-sm">
              Direct printing is only available in the Vedix POS Android app. In a browser, printing
              opens the usual print dialog instead.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>How is it connected?</Label>
              <div className="flex flex-wrap gap-2">
                {TRANSPORTS.map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    data-kbd-item=""
                    variant={transport === t.value ? "default" : "outline"}
                    onClick={() => {
                      setTransport(t.value);
                      setFound([]);
                      setAddress("");
                    }}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              {activeHint && <p className="text-muted-foreground text-xs">{activeHint}</p>}
            </div>

            {transport === "network" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <div className="space-y-1.5">
                  <Label htmlFor="printer-host">IP address</Label>
                  <Input
                    id="printer-host"
                    data-kbd-item=""
                    placeholder="192.168.1.50"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="printer-port">Port</Label>
                  <Input
                    id="printer-port"
                    data-kbd-item=""
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Printer</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-kbd-item=""
                    disabled={busy}
                    onClick={() => void scan()}
                  >
                    {busy ? "Looking…" : "Find printers"}
                  </Button>
                  {found.length > 0 && (
                    <div className="min-w-56 flex-1">
                      <SearchableSelect
                        data-kbd-item=""
                        options={found.map((p) => ({ value: p.address, label: p.name }))}
                        value={address || null}
                        onChange={(v) => {
                          setAddress(v ?? "");
                          setName(found.find((p) => p.address === v)?.name ?? "");
                        }}
                        placeholder="Select printer…"
                      />
                    </div>
                  )}
                </div>
                {address && (
                  <p className="text-muted-foreground text-xs">
                    Selected: {name || address} ({address})
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Paper width</Label>
              <div className="flex gap-2">
                {(["58", "80"] as const).map((w) => (
                  <Button
                    key={w}
                    type="button"
                    data-kbd-item=""
                    variant={paperWidth === w ? "default" : "outline"}
                    onClick={() => setPaperWidth(w)}
                  >
                    {w}mm
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button data-kbd-item="" onClick={save}>
                Save
              </Button>
              <Button
                variant="outline"
                data-kbd-item=""
                disabled={busy}
                onClick={() => void testPrint()}
              >
                Test print
              </Button>
              <Button
                variant="ghost"
                data-kbd-item=""
                onClick={() => {
                  writePrinterConfig(null);
                  setAddress("");
                  setName("");
                  toast.success("Printer cleared — printing will use the print dialog.");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
