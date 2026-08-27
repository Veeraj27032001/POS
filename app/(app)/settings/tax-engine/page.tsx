"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import { Button } from "@/components/ui/button";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StoreRow {
  id: string;
  name: string;
  taxEngineId: string | null;
}

export default function TaxEnginePage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<StoreRow | null | undefined>(undefined);
  const [taxEngineId, setTaxEngineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const taxEngines = useOptionsList("tax-engines/options", "name");

  useEffect(() => {
    if (!selectedStoreId) return;
    setStore(undefined);
    fetch(`/api/stores/${selectedStoreId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((row: StoreRow | null) => {
        setStore(row);
        setTaxEngineId(row?.taxEngineId ?? null);
      });
  }, [selectedStoreId]);

  async function handleSave() {
    if (!selectedStoreId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${selectedStoreId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxEngineId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save.");
        return;
      }
      toast.success("Tax engine updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Tax Engine</h1>
      <p className="text-muted-foreground text-sm">
        Choose which tax engine each store uses. A new store starts with none selected.
      </p>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {store === undefined && selectedStoreId && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {store && (
        <div className="max-w-md space-y-3 rounded-lg border p-4">
          <div className="text-sm font-medium">{store.name}</div>
          <SearchableSelect
            options={taxEngines}
            value={taxEngineId}
            onChange={setTaxEngineId}
            placeholder="Select tax engine…"
          />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
