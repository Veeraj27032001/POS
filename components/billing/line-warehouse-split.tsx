"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useOptionsList } from "@/lib/masters/useOptionsList";

export interface AllocationDisplay {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

// Auto-allocation (oldest-stocked warehouse first, preferring a single
// warehouse over a split) picks the split by default — this modal is the
// manual override. Purely local: nothing here talks to the server, it just
// tells the parent cart line what split to use the next time the cart is
// actually saved (Save draft/Hold/Create bill). If a previously-chosen
// override has gone stale by then, the server falls back to a fresh
// automatic split rather than failing — allocations shown here always
// reflect live stock since they come from the read-only preview.
export function LineWarehouseSplit({
  productName,
  quantity,
  allocations,
  hasManualOverride,
  warning,
  onSave,
  onClearOverride,
}: {
  productName: string;
  quantity: number;
  allocations: AllocationDisplay[];
  hasManualOverride: boolean;
  warning: string | null;
  onSave: (allocations: { warehouseId: string; quantity: number }[]) => void;
  onClearOverride: () => void;
}) {
  const warehouses = useOptionsList("warehouses", "name");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const a of allocations) initial[a.warehouseId] = String(a.quantity);
    setDraft(initial);
  }, [open, allocations]);

  const draftTotal = Object.values(draft).reduce((sum, v) => sum + (Number(v) || 0), 0);

  function save() {
    const entries = Object.entries(draft)
      .map(([warehouseId, v]) => ({ warehouseId, quantity: Number(v) || 0 }))
      .filter((a) => a.quantity > 0);
    if (entries.reduce((sum, a) => sum + a.quantity, 0) !== quantity) {
      toast.error(`Allocations must add up to ${quantity}.`);
      return;
    }
    onSave(entries);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="text-muted-foreground text-xs">
        <DialogTrigger render={<button type="button" className="text-primary hover:underline" />}>
          {allocations.length > 0
            ? allocations.map((a) => `${a.warehouseName}: ${a.quantity}`).join(", ")
            : "Choose warehouses"}
        </DialogTrigger>
        {warning && <div className="text-warning mt-0.5">{warning}</div>}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Warehouse split — {productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {warehouses.map((w) => (
            <div key={w.value} className="flex items-center gap-2">
              <span className="w-32 truncate text-sm">{w.label}</span>
              <Input
                type="number"
                min={0}
                className="h-8 w-24"
                value={draft[w.value] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [w.value]: e.target.value }))}
              />
            </div>
          ))}
          <div className="text-muted-foreground text-xs">
            {draftTotal} / {quantity}
          </div>
        </div>
        <DialogFooter>
          {hasManualOverride && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClearOverride();
                setOpen(false);
              }}
            >
              Use automatic
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
