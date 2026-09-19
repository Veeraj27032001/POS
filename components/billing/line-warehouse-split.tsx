"use client";

import { Loader2Icon } from "lucide-react";
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
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

export interface AllocationDisplay {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

export interface WarehouseAvailabilityDisplay {
  warehouseId: string;
  warehouseName: string;
  available: number;
}

// Auto-allocation (oldest-stocked warehouse first, preferring a single
// warehouse over a split) picks the split by default — this modal is the
// manual override. Purely local: nothing here talks to the server, it just
// tells the parent cart line what split to use the next time the cart is
// actually saved (Save draft/Hold/Create bill). If a previously-chosen
// override has gone stale by then, the server falls back to a fresh
// automatic split rather than failing — allocations and per-warehouse
// stock shown here always reflect live numbers since they come from the
// read-only preview.
export function LineWarehouseSplit({
  productName,
  quantity,
  allocations,
  warehouseAvailability,
  hasManualOverride,
  warning,
  loading,
  onSave,
  onClearOverride,
}: {
  productName: string;
  quantity: number;
  allocations: AllocationDisplay[];
  warehouseAvailability: WarehouseAvailabilityDisplay[];
  hasManualOverride: boolean;
  warning: string | null;
  loading: boolean;
  onSave: (allocations: { warehouseId: string; quantity: number }[]) => void;
  onClearOverride: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const kbdRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-kbd-item]" });

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
    for (const entry of entries) {
      const available = warehouseAvailability.find(
        (w) => w.warehouseId === entry.warehouseId,
      )?.available;
      if (available !== undefined && entry.quantity > available) {
        toast.error(`Only ${available} available at that storage location.`);
        return;
      }
    }
    onSave(entries);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1.5 text-xs">
        <DialogTrigger
          render={
            <button type="button" data-kbd-item="" className="text-primary hover:underline" />
          }
        >
          {allocations.length > 0
            ? allocations.map((a) => `${a.warehouseName}: ${a.quantity}`).join(", ")
            : "Choose storage"}
        </DialogTrigger>
        {loading && <Loader2Icon className="text-muted-foreground size-3 animate-spin" />}
      </div>
      {warning && <div className="text-warning text-xs">{warning}</div>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Storage split — {productName}</DialogTitle>
        </DialogHeader>
        <div ref={kbdRef} className="contents">
          <div className="space-y-1">
            {warehouseAvailability.map((w) => (
              <div key={w.warehouseId} className="flex items-center gap-2">
                <span className="w-32 truncate text-sm">{w.warehouseName}</span>
                <Input
                  type="number"
                  min={0}
                  max={w.available}
                  data-kbd-item=""
                  className="h-8 w-24"
                  value={draft[w.warehouseId] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [w.warehouseId]: e.target.value }))}
                />
                <span className="text-muted-foreground text-xs">{w.available} available</span>
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
                data-kbd-item=""
                onClick={() => {
                  onClearOverride();
                  setOpen(false);
                }}
              >
                Use automatic
              </Button>
            )}
            <Button type="button" variant="outline" data-kbd-item="" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" data-kbd-item="" onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
