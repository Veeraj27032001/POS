"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface CustomerInfo {
  id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  countryId: string | null;
  stateId: string | null;
  pincode: string | null;
}

interface Draft {
  name: string;
  phone: string;
  email: string;
  address: string;
  countryId: string | null;
  stateId: string | null;
  pincode: string;
}

function draftFromCustomer(customer: CustomerInfo | null): Draft {
  return {
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    countryId: customer?.countryId ?? null,
    stateId: customer?.stateId ?? null,
    pincode: customer?.pincode ?? "",
  };
}

// Billing detail fields, not a "create customer" form — always visible, no
// submit button, no foreign key to the Customers master. Typing auto-saves
// (debounced) as plain fields on the bill itself. Picking someone from the
// "Existing customer" dropdown is the only way to get a real linked
// customer — it fills these same fields from that record; editing a field
// afterward detaches the link and reverts to plain, unlinked entry (see
// app/api/bills/[id]/customer-details/route.ts).
export function CustomerDetailsFields({
  billId,
  customer,
  customers,
  onSelectExisting,
  onUpdated,
}: {
  billId: string;
  customer: CustomerInfo | null;
  customers: SearchableSelectOption[];
  onSelectExisting: (customerId: string) => void;
  onUpdated: () => void;
}) {
  const countries = useOptionsList("countries", "name");

  const [draft, setDraft] = useState<Draft>(() => draftFromCustomer(customer));
  const states = useOptionsList(
    "states",
    "name",
    draft.countryId ? `countryId=${draft.countryId}` : undefined,
  );

  const syncedCustomerId = useRef<string | null>(customer?.id ?? null);
  const lastSentPayload = useRef(JSON.stringify(draftFromCustomer(customer)));
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (customer?.id === syncedCustomerId.current) return;
    syncedCustomerId.current = customer?.id ?? null;
    const next = draftFromCustomer(customer);
    setDraft(next);
    lastSentPayload.current = JSON.stringify(next);
  }, [customer]);

  const debouncedDraft = useDebouncedValue(draft, 600);
  useEffect(() => {
    const payload = JSON.stringify(debouncedDraft);
    if (payload === lastSentPayload.current) return;
    lastSentPayload.current = payload;
    void sync(debouncedDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraft]);

  async function sync(values: Draft) {
    setSyncing(true);
    try {
      const res = await fetch(`/api/bills/${billId}/customer-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name || null,
          phone: values.phone || null,
          email: values.email || null,
          address: values.address || null,
          countryId: values.countryId,
          stateId: values.stateId,
          pincode: values.pincode || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update customer details.");
        return;
      }
      onUpdated();
    } finally {
      setSyncing(false);
    }
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label>Existing customer</Label>
          {syncing && <Loader2Icon className="text-muted-foreground size-3.5 animate-spin" />}
        </div>
        <SearchableSelect
          options={customers}
          value={customer?.id ?? null}
          onChange={(v) => {
            if (v) onSelectExisting(v);
          }}
          placeholder="Select customer…"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={draft.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <SearchableSelect
            options={countries}
            value={draft.countryId}
            onChange={(v) => setDraft((d) => ({ ...d, countryId: v, stateId: null }))}
            placeholder="Select country…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <SearchableSelect
            options={states}
            value={draft.stateId}
            onChange={(v) => set("stateId", v)}
            placeholder="Select state…"
            disabled={!draft.countryId}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Pincode</Label>
          <Input value={draft.pincode} onChange={(e) => set("pincode", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
