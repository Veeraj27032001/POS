"use client";

import { useState } from "react";
import { toast } from "sonner";

import { BarcodePreview } from "@/components/barcode-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPrintBridge } from "@/lib/adapters/print";

export function PrintLabelButton({
  barcodeValue,
  productName,
  price,
}: {
  barcodeValue: string;
  productName: string;
  price: number;
}) {
  const [open, setOpen] = useState(false);
  const [copies, setCopies] = useState("1");
  const [printing, setPrinting] = useState(false);

  const count = Math.floor(Number(copies));
  const valid = Number.isFinite(count) && count >= 1 && count <= 100;

  async function handlePrint() {
    if (!valid) return;
    setPrinting(true);
    try {
      await getPrintBridge().print({
        kind: "label",
        labels: [{ barcodeValue, productName, price, copies: count }],
      });
      setOpen(false);
      setCopies("1");
    } catch {
      toast.error("Failed to print the label.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" data-kbd-item="">
            Print
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Print label</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <BarcodePreview value={barcodeValue} height={90} />
          <p className="font-mono text-sm">{barcodeValue}</p>
          <p className="text-muted-foreground text-sm">{productName}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="label-copies">Copies</Label>
          <Input
            id="label-copies"
            type="number"
            min={1}
            max={100}
            data-kbd-item=""
            value={copies}
            onChange={(e) => setCopies(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handlePrint();
              }
            }}
          />
          {!valid && <p className="text-sm text-red-600">Enter a number between 1 and 100.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" data-kbd-item="" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button data-kbd-item="" disabled={!valid || printing} onClick={() => void handlePrint()}>
            {printing ? "Printing…" : "Print"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
