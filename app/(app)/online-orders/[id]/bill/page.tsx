"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";

interface OnlineOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
}

interface OnlineOrderDetail {
  id: string;
  documentNumber: string;
  status: "pending" | "accepted" | "rejected";
  customerName: string;
  customerPhone: string;
  storeId: string;
  items: OnlineOrderItem[];
}

interface BillLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  included: boolean;
}

export default function GenerateBillPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currencySymbol = useStoreCurrencySymbol();
  const stores = useOptionsList("stores/options", "name");

  const [order, setOrder] = useState<OnlineOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/online-orders/${params.id}`);
        if (res.ok) {
          const body = (await res.json()) as OnlineOrderDetail;
          setOrder(body);
          setStoreId(body.storeId);
          setLines(
            body.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              unitPrice: Number(item.unitPrice),
              quantity: item.quantity,
              included: true,
            })),
          );
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id]);

  function updateQuantity(productId: string, quantity: number) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  }

  function toggleIncluded(productId: string) {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, included: !l.included } : l)),
    );
  }

  const activeLines = lines.filter((l) => l.included);
  const estimatedTotal = activeLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  async function generate() {
    if (!storeId) {
      toast.error("Select which store bills this order.");
      return;
    }
    if (activeLines.length === 0) {
      toast.error("At least one line is required.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/online-orders/${params.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          lines: activeLines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error?.message ?? "Failed to generate the bill.");
        return;
      }
      toast.success("Bill generated.");
      router.push(`/bills/${body.billId}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Loading…</div>;
  if (!order) return <div className="p-8">Online order not found.</div>;
  if (order.status !== "pending") {
    return (
      <div className="p-8">
        <p>This order is already {order.status} — nothing to generate.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/online-orders/${order.id}`)}
        >
          Back to order
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Generate Bill — {order.documentNumber}</h1>
        <p className="text-muted-foreground text-sm">
          Review the order, choose which store bills it, and adjust quantities if needed. Nothing is
          finalized until you click Generate Bill below.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{order.customerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{order.customerPhone}</dd>
        </div>
      </dl>

      <div className="max-w-xs space-y-1.5">
        <Label>Bill from store</Label>
        <SearchableSelect
          options={stores}
          value={storeId}
          onChange={setStoreId}
          placeholder="Select a store…"
        />
      </div>

      <div className="divide-y rounded-lg border">
        {lines.map((line) => (
          <div key={line.productId} className="flex items-center gap-4 p-3 text-sm">
            <input
              type="checkbox"
              checked={line.included}
              onChange={() => toggleIncluded(line.productId)}
              className="h-4 w-4"
            />
            <span className={`flex-1 ${line.included ? "" : "text-muted-foreground line-through"}`}>
              {line.productName}
            </span>
            <span className="text-muted-foreground">
              {currencySymbol}
              {line.unitPrice.toFixed(2)} each
            </span>
            <Input
              type="number"
              min={1}
              value={line.quantity}
              disabled={!line.included}
              onChange={(e) =>
                updateQuantity(line.productId, Math.max(1, Number(e.target.value) || 1))
              }
              className="w-20"
            />
            <span className="w-24 text-right font-medium">
              {currencySymbol}
              {(line.unitPrice * line.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between p-3 text-sm font-semibold">
          <span>Estimated total (tax not included yet)</span>
          <span>
            {currencySymbol}
            {estimatedTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {message && <p className="text-destructive text-sm">{message}</p>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push(`/online-orders/${order.id}`)}>
          Cancel
        </Button>
        <Button onClick={() => void generate()} disabled={submitting}>
          {submitting ? "Generating…" : "Generate Bill"}
        </Button>
      </div>
    </div>
  );
}
