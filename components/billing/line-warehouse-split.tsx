"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface Allocation {
  warehouseId: string;
  quantity: number;
  warehouse: { id: string; name: string };
}

// Auto-allocation (oldest-stocked warehouse first, preferring a single
// warehouse over a split) picks the split by default — this is the manual
// override, shown per line, for a cashier who wants to choose it themselves.
export function LineWarehouseSplit({
  billId,
  lineId,
  quantity,
  allocations,
  onUpdated,
}: {
  billId: string;
  lineId: string;
  quantity: number;
  allocations: Allocation[];
  onUpdated: () => void;
}) {
  const warehouses = useOptionsList("warehouses", "name");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function startEdit() {
    const initial: Record<string, string> = {};
    for (const a of allocations) initial[a.warehouseId] = String(a.quantity);
    setDraft(initial);
    setEditing(true);
  }

  const draftTotal = Object.values(draft).reduce((sum, v) => sum + (Number(v) || 0), 0);

  async function save() {
    const entries = Object.entries(draft)
      .map(([warehouseId, v]) => ({ warehouseId, quantity: Number(v) || 0 }))
      .filter((a) => a.quantity > 0);
    if (entries.reduce((sum, a) => sum + a.quantity, 0) !== quantity) {
      toast.error(`Allocations must add up to ${quantity}.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bills/${billId}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, allocations: entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update warehouse split.");
        return;
      }
      toast.success("Warehouse split updated.");
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="text-muted-foreground text-xs">
        {allocations.length > 0 ? (
          <>
            {allocations.map((a) => `${a.warehouse.name}: ${a.quantity}`).join(", ")}{" "}
            <button type="button" className="text-primary hover:underline" onClick={startEdit}>
              Change
            </button>
          </>
        ) : (
          <button type="button" className="text-primary hover:underline" onClick={startEdit}>
            Choose warehouses
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card space-y-1 rounded border p-2">
      {warehouses.map((w) => (
        <div key={w.value} className="flex items-center gap-2">
          <span className="w-24 truncate text-xs">{w.label}</span>
          <Input
            type="number"
            min={0}
            className="h-7 w-20"
            value={draft[w.value] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [w.value]: e.target.value }))}
          />
        </div>
      ))}
      <div className="text-muted-foreground text-xs">
        {draftTotal} / {quantity}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
