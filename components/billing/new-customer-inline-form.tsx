"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface CreatedCustomer {
  id: string;
  name: string;
  phone: string | null;
}

// step5 §5's inline auto-create: type a new customer's details directly at
// billing time instead of a detour to the customer master. Only name is
// required — everything else, including phone, is optional here (unlike
// the customer master's own form, which still nudges for it).
export function NewCustomerInlineForm({
  storeId,
  onCreated,
  onCancel,
}: {
  storeId: string;
  onCreated: (customer: CreatedCustomer) => void;
  onCancel: () => void;
}) {
  const countries = useOptionsList("countries", "name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [countryId, setCountryId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  const states = useOptionsList("states", "name", countryId ? `countryId=${countryId}` : undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/stores/defaults")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { countryId: string | null; stateId: string | null } | null) => {
        if (body?.countryId) setCountryId(body.countryId);
        if (body?.stateId) setStateId(body.stateId);
      });
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          countryId,
          stateId,
          pincode: pincode.trim() || null,
          storeIds: [storeId],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to create customer.");
        return;
      }
      const created = (await res.json()) as CreatedCustomer;
      toast.success("Customer created.");
      onCreated(created);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            Name
            <RequiredMark />
          </Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>
            Phone <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>
            Email <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>
            Address
            <RequiredMark />
          </Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>
            Country <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <SearchableSelect
            options={countries}
            value={countryId}
            onChange={(v) => {
              setCountryId(v);
              setStateId(null);
            }}
            placeholder="Select country…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            State <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <SearchableSelect
            options={states}
            value={stateId}
            onChange={setStateId}
            placeholder="Select state…"
            disabled={!countryId}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Pincode <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input value={pincode} onChange={(e) => setPincode(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? "Creating…" : "Create customer"}
        </Button>
      </div>
    </div>
  );
}
