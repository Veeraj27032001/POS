"use client";

import { useState } from "react";

import { BarcodePreview } from "@/components/barcode-preview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BarcodeViewDialog({ value, label }: { value: string; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            data-kbd-item=""
            className="hover:ring-primary rounded-md p-1 transition hover:ring-2"
          />
        }
      >
        <BarcodePreview value={value} />
      </DialogTrigger>
      <DialogContent
        overlayClassName="bg-black/90 backdrop-blur-lg"
        className="sm:max-w-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{label ?? "Barcode"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <BarcodePreview value={value} height={140} />
          <p className="font-mono text-lg">{value}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
