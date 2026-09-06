"use client";

import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp } from "@/lib/datetime/format";
import { downloadIntegrationGuidePdf } from "@/lib/ecommerce/integrationGuidePdf";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

interface ApiCredentialRow {
  id: string;
  label: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  billingStoreId: string;
  billingStore: { name: string } | null;
  storeIds: string[];
}

const API_LIST: { method: string; path: string; description: string }[] = [
  {
    method: "GET",
    path: "/api/v1/ecommerce/stores",
    description: "Every store this credential can sell from and bill to.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/categories",
    description: "Category list for catalog navigation/filtering.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/products",
    description:
      "List active, stock-tracked products with price, images, tax info, and live available stock.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/products/{product_id}",
    description: "Single product detail, for a product page.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/products/{product_id}/stock",
    description: "Real-time available-stock check for one product.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/stock-lock",
    description: "Reserve a quantity for a product — cart/checkout in progress.",
  },
  {
    method: "DELETE",
    path: "/api/v1/ecommerce/stock-lock/{id}",
    description: "Release a stock lock — abandoned cart, failed checkout.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/orders",
    description:
      "Place an order once payment is confirmed on your side — lands as pending, awaiting staff Accept/Reject in Online Orders.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/orders/{order_id}",
    description:
      "Single order lookup — order confirmation/tracking, at any stage of its lifecycle.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/customers/request-otp",
    description:
      "Registers or re-sends a sign-in code — phone required; email only needed if SMS isn't configured.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/customers/verify-otp",
    description: "Verifies the code and returns the customer.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/customers/login",
    description: "Phone + password sign-in, once a customer has set one.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/customers/set-password",
    description: "Sets/changes a signed-in customer's password.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/customers/reset-password",
    description: "Forgot password: verifies a code and sets a new password in one step.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/customers/{customer_id}",
    description: "Re-fetch a signed-in customer's profile.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/customers/{customer_id}/orders",
    description: "A customer's own order history.",
  },
];

function NewCredentialDialog({ onCreated }: { onCreated: () => void }) {
  const stores = useOptionsList("stores/options", "name");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [billingStoreId, setBillingStoreId] = useState<string | null>(null);
  const [otherStoreIds, setOtherStoreIds] = useState<string[]>([]);
  const [splitOrdersEnabled, setSplitOrdersEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    apiKey: string;
    apiSecret: string;
    storeName: string;
  } | null>(null);

  const otherStores = stores.filter((s) => s.value !== billingStoreId);

  function toggleOtherStore(id: string, checked: boolean) {
    setOtherStoreIds((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  }

  async function submit() {
    if (!label.trim()) {
      toast.error("Give this credential a label.");
      return;
    }
    if (!billingStoreId) {
      toast.error("Select which store handles billing.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/api-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          billingStoreId,
          storeIds: [billingStoreId, ...otherStoreIds],
          splitOrdersEnabled: otherStoreIds.length > 0 && splitOrdersEnabled,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to create the credential.");
        return;
      }
      const body = await res.json();
      const storeName = stores.find((s) => s.value === billingStoreId)?.label ?? "Store";
      setCreated({ apiKey: body.apiKey, apiSecret: body.apiSecret, storeName });
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setLabel("");
    setBillingStoreId(null);
    setOtherStoreIds([]);
    setSplitOrdersEnabled(false);
    setCreated(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <DialogTrigger render={<Button />}>New credential</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New API credential</DialogTitle>
        </DialogHeader>

        {!created && (
          <>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. My Shopify Store"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Billing store</Label>
              <SearchableSelect
                options={stores}
                value={billingStoreId}
                onChange={(id) => {
                  setBillingStoreId(id);
                  setOtherStoreIds((prev) => prev.filter((s) => s !== id));
                }}
                placeholder="Select a store…"
              />
              <p className="text-muted-foreground text-xs">
                Every order is billed here by default, unless the request names a different store
                below.
              </p>
            </div>

            {billingStoreId && otherStores.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-1.5">
                  <Label>Also sell from</Label>
                  <div className="max-h-32 space-y-1.5 overflow-y-auto">
                    {otherStores.map((store) => (
                      <div key={store.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`store-${store.value}`}
                          checked={otherStoreIds.includes(store.value)}
                          onCheckedChange={(checked) =>
                            toggleOtherStore(store.value, checked === true)
                          }
                        />
                        <Label htmlFor={`store-${store.value}`}>{store.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                {otherStoreIds.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="split-orders-enabled"
                        checked={splitOrdersEnabled}
                        onCheckedChange={(checked) => setSplitOrdersEnabled(checked === true)}
                      />
                      <Label htmlFor="split-orders-enabled">
                        Allow one order to split across stores when no single store has enough stock
                      </Label>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      The billing store is tried first. If it can&apos;t cover an order alone, stock
                      moves in from another selected store automatically — the order still gets one
                      bill.
                    </p>
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={submitting}>
                {submitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}

        {created && (
          <>
            <p className="text-muted-foreground text-sm">
              Copy the secret now — it won&apos;t be shown again.
            </p>
            <div className="space-y-1.5">
              <Label>API key</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.apiKey} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(created.apiKey);
                    toast.success("API key copied.");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>API secret</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.apiSecret} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(created.apiSecret);
                    toast.success("API secret copied.");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadIntegrationGuidePdf({
                    storeName: created.storeName,
                    apiKey: created.apiKey,
                    apiSecret: created.apiSecret,
                  })
                }
              >
                Download setup guide (PDF)
              </Button>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditCredentialDialog({ row, onSaved }: { row: ApiCredentialRow; onSaved: () => void }) {
  const stores = useOptionsList("stores/options", "name");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(row.label);
  const [billingStoreId, setBillingStoreId] = useState<string | null>(row.billingStoreId);
  const [otherStoreIds, setOtherStoreIds] = useState<string[]>(
    row.storeIds.filter((id) => id !== row.billingStoreId),
  );
  const [splitOrdersEnabled, setSplitOrdersEnabled] = useState(row.storeIds.length > 1);
  const [submitting, setSubmitting] = useState(false);

  const otherStores = stores.filter((s) => s.value !== billingStoreId);

  function toggleOtherStore(id: string, checked: boolean) {
    setOtherStoreIds((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  }

  function reset() {
    setLabel(row.label);
    setBillingStoreId(row.billingStoreId);
    setOtherStoreIds(row.storeIds.filter((id) => id !== row.billingStoreId));
    setSplitOrdersEnabled(row.storeIds.length > 1);
  }

  async function submit() {
    if (!label.trim()) {
      toast.error("Give this credential a label.");
      return;
    }
    if (!billingStoreId) {
      toast.error("Select which store handles billing.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/api-credentials/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          billingStoreId,
          storeIds: [billingStoreId, ...otherStoreIds],
          splitOrdersEnabled: otherStoreIds.length > 0 && splitOrdersEnabled,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save changes.");
        return;
      }
      toast.success("Credential updated.");
      onSaved();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Edit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit API credential</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Billing store</Label>
          <SearchableSelect
            options={stores}
            value={billingStoreId}
            onChange={(id) => {
              setBillingStoreId(id);
              setOtherStoreIds((prev) => prev.filter((s) => s !== id));
            }}
            placeholder="Select a store…"
          />
          <p className="text-muted-foreground text-xs">
            Every order is billed here by default, unless the request names a different store below.
          </p>
        </div>

        {billingStoreId && otherStores.length > 0 && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label>Also sell from</Label>
              <div className="max-h-32 space-y-1.5 overflow-y-auto">
                {otherStores.map((store) => (
                  <div key={store.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-store-${row.id}-${store.value}`}
                      checked={otherStoreIds.includes(store.value)}
                      onCheckedChange={(checked) => toggleOtherStore(store.value, checked === true)}
                    />
                    <Label htmlFor={`edit-store-${row.id}-${store.value}`}>{store.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            {otherStoreIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`edit-split-${row.id}`}
                  checked={splitOrdersEnabled}
                  onCheckedChange={(checked) => setSplitOrdersEnabled(checked === true)}
                />
                <Label htmlFor={`edit-split-${row.id}`}>
                  Allow one order to split across stores when no single store has enough stock
                </Label>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EcommerceSettingsPage() {
  const invalidate = useInvalidateResource();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/api-credentials/${id}/revoke`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to revoke the credential.");
        return;
      }
      toast.success("Credential revoked.");
      invalidate("api-credentials");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">E-commerce</h1>
        <p className="text-muted-foreground text-sm">
          Connect your own e-commerce app/website to this POS so stock and orders stay in sync. Each
          credential below has its own downloadable setup guide.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API credentials</h2>
          <NewCredentialDialog onCreated={() => invalidate("api-credentials")} />
        </div>
        <DataTable<ApiCredentialRow>
          resource="api-credentials"
          getRowId={(row) => row.id}
          emptyMessage="No API credentials yet."
          columns={[
            { key: "label", header: "Label" },
            {
              key: "apiKey",
              header: "API key",
              render: (row) => <span className="font-mono text-xs">{row.apiKey}</span>,
            },
            {
              key: "billingStore",
              header: "Billing store",
              render: (row) => row.billingStore?.name ?? "—",
            },
            {
              key: "storeIds",
              header: "Stores",
              render: (row) =>
                row.storeIds.length > 1 ? (
                  <Badge variant="secondary">{row.storeIds.length} stores</Badge>
                ) : (
                  "1 store"
                ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) =>
                row.revokedAt ? (
                  <Badge variant="secondary">Revoked</Badge>
                ) : row.isActive ? (
                  <Badge>Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                ),
            },
            {
              key: "lastUsedAt",
              header: "Last used",
              render: (row) => (row.lastUsedAt ? formatTimestamp(row.lastUsedAt) : "Never"),
            },
            {
              key: "createdAt",
              header: "Created",
              render: (row) => formatTimestamp(row.createdAt),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <div className="flex justify-end gap-2">
                  {!row.revokedAt && (
                    <EditCredentialDialog row={row} onSaved={() => invalidate("api-credentials")} />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadIntegrationGuidePdf({
                        storeName: row.billingStore?.name ?? "Store",
                        apiKey: row.apiKey,
                        apiSecret: "(already shown once at creation — not retrievable again)",
                      })
                    }
                  >
                    Guide
                  </Button>
                  {!row.revokedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokingId === row.id}
                      onClick={() => void revoke(row.id)}
                    >
                      {revokingId === row.id ? "Revoking…" : "Revoke"}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Available APIs</h2>
        <div className="divide-y rounded-lg border">
          {API_LIST.map((api) => (
            <div
              key={api.path}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex shrink-0 items-center gap-2 sm:w-64">
                <Badge variant="secondary" className="font-mono">
                  {api.method}
                </Badge>
                <code className="text-xs break-all">{api.path}</code>
              </div>
              <p className="text-muted-foreground text-sm">{api.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
