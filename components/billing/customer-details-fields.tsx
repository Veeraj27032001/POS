"use client";

import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOptionsList } from "@/lib/masters/useOptionsList";

export interface CustomerDraft {
  name: string;
  phone: string;
  email: string;
  address: string;
  countryId: string | null;
  stateId: string | null;
  pincode: string;
}

export const emptyCustomerDraft: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  address: "",
  countryId: null,
  stateId: null,
  pincode: "",
};

// Purely controlled — no network calls, no FK. Parent decides when to save.
export function CustomerDetailsFields({
  selectedCustomerId,
  draft,
  customers,
  onSelectExisting,
  onChange,
}: {
  selectedCustomerId: string | null;
  draft: CustomerDraft;
  customers: SearchableSelectOption[];
  onSelectExisting: (customerId: string) => void;
  onChange: (draft: CustomerDraft) => void;
}) {
  const countries = useOptionsList("countries", "name");
  const states = useOptionsList(
    "states",
    "name",
    draft.countryId ? `countryId=${draft.countryId}` : undefined,
  );

  function set<K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Existing customer</Label>
        <SearchableSelect
          options={customers}
          value={selectedCustomerId}
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
            onChange={(v) => onChange({ ...draft, countryId: v, stateId: null })}
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
