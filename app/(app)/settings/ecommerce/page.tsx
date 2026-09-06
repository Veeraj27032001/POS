"use client";

import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { StoreCardFilter } from "@/components/store-card-filter";
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
import type { SearchableSelectOption } from "@/components/searchable-select";
import { formatTimestamp } from "@/lib/datetime/format";
import { buildIntegrationGuideHtml } from "@/lib/ecommerce/integrationGuideHtml";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

function openAndPrintHtml(html: string): void {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    toast.error("The setup guide window was blocked by the browser's popup blocker.");
    return;
  }
  win.document.write(html);
  win.document.write("<script>window.onload = () => window.print();<\/script>");
  win.document.close();
}

interface ApiCredentialRow {
  id: string;
  label: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  multiStoreEnabled: boolean;
  splitOrdersEnabled: boolean;
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
    path: "/api/v1/ecommerce/bills",
    description: "Create a completed Online Bill once the order is confirmed/paid on your side.",
  },
  {
    method: "GET",
    path: "/api/v1/ecommerce/orders/{order_id}",
    description: "Single order lookup — order confirmation/tracking.",
  },
  {
    method: "POST",
    path: "/api/v1/ecommerce/customers/request-otp",
    description: "Registers or re-sends a sign-in code (SMS, or email as a fallback).",
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

function NewCredentialDialog({
  storeId,
  storeName,
  otherStores,
  onCreated,
}: {
  storeId: string;
  storeName: string;
  otherStores: SearchableSelectOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [multiStoreEnabled, setMultiStoreEnabled] = useState(false);
  const [splitOrdersEnabled, setSplitOrdersEnabled] = useState(false);
  const [fulfilmentStoreIds, setFulfilmentStoreIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ apiKey: string; apiSecret: string } | null>(null);

  function toggleFulfilmentStore(id: string, checked: boolean) {
    setFulfilmentStoreIds((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  }

  async function submit() {
    if (!label.trim()) {
      toast.error("Give this credential a label.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/api-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          storeId,
          multiStoreEnabled,
          splitOrdersEnabled: multiStoreEnabled && splitOrdersEnabled,
          fulfilmentStoreIds: multiStoreEnabled ? fulfilmentStoreIds : [],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to create the credential.");
        return;
      }
      const body = await res.json();
      setCreated({ apiKey: body.apiKey, apiSecret: body.apiSecret });
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setLabel("");
    setMultiStoreEnabled(false);
    setSplitOrdersEnabled(false);
    setFulfilmentStoreIds([]);
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="multi-store-enabled"
                checked={multiStoreEnabled}
                onCheckedChange={(checked) => setMultiStoreEnabled(checked === true)}
              />
              <Label htmlFor="multi-store-enabled">
                Sell from more than one store ({storeName} plus others)
              </Label>
            </div>

            {multiStoreEnabled && (
              <div className="space-y-3 rounded-lg border p-3">
                {otherStores.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No other stores exist yet — this will only sell from {storeName}.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Also sell from</Label>
                    <div className="max-h-32 space-y-1.5 overflow-y-auto">
                      {otherStores.map((store) => (
                        <div key={store.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`fulfil-${store.value}`}
                            checked={fulfilmentStoreIds.includes(store.value)}
                            onCheckedChange={(checked) =>
                              toggleFulfilmentStore(store.value, checked === true)
                            }
                          />
                          <Label htmlFor={`fulfil-${store.value}`}>{store.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  {storeName} is tried first. If it can&apos;t cover an order alone, stock moves in
                  from another eligible store automatically — the order still gets one bill, at{" "}
                  {storeName}.
                </p>
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
                onClick={() => {
                  const html = buildIntegrationGuideHtml({
                    storeName,
                    apiKey: created.apiKey,
                  }).replace("{{API_SECRET}}", created.apiSecret);
                  openAndPrintHtml(html);
                }}
              >
                Download setup guide
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

export default function EcommerceSettingsPage() {
  const invalidate = useInvalidateResource();
  const stores = useOptionsList("stores/options", "name");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const selectedStoreName = stores.find((s) => s.value === selectedStoreId)?.label ?? "Your store";
  const otherStores = stores.filter((s) => s.value !== selectedStoreId);

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
          credential below has its own setup guide — no separate download needed.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">API credentials</h2>
        <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {selectedStoreId && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <NewCredentialDialog
              storeId={selectedStoreId}
              storeName={selectedStoreName}
              otherStores={otherStores}
              onCreated={() => invalidate("api-credentials")}
            />
          </div>
          <DataTable<ApiCredentialRow>
            resource="api-credentials"
            getRowId={(row) => row.id}
            filters={{ storeId: selectedStoreId }}
            emptyMessage="No API credentials yet for this store."
            columns={[
              { key: "label", header: "Label" },
              {
                key: "apiKey",
                header: "API key",
                render: (row) => <span className="font-mono text-xs">{row.apiKey}</span>,
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
                key: "multiStoreEnabled",
                header: "Stores",
                render: (row) =>
                  row.multiStoreEnabled ? (
                    <Badge variant="secondary">
                      Multi-store{row.splitOrdersEnabled ? " + split" : ""}
                    </Badge>
                  ) : (
                    "Single"
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const html = buildIntegrationGuideHtml({
                          storeName: selectedStoreName,
                          apiKey: row.apiKey,
                        }).replace(
                          "{{API_SECRET}}",
                          "(already shown once at creation — not retrievable again)",
                        );
                        openAndPrintHtml(html);
                      }}
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
      )}

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
