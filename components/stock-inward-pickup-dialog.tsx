"use client";

import { useEffect, useState } from "react";

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
import { cn } from "@/lib/utils";

interface ProductRequestSummary {
  id: string;
  documentNumber: string;
  supplierId: string;
  status: string;
}

interface ProductRequestItemDetail {
  id: string;
  productId: string;
  productName: string;
  quantityRequested: number;
  quantityReceived: number;
  expectedUnitCost: string | null;
}

export interface PickedItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost?: number;
}

interface PickState {
  checked: boolean;
  quantity: number;
}

const PICKABLE_STATUSES = new Set(["sent", "partially_received"]);

export function StockInwardPickupDialog({
  onPicked,
}: {
  onPicked: (result: {
    purchaseOrderId: string;
    documentNumber: string;
    items: PickedItem[];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [requests, setRequests] = useState<ProductRequestSummary[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ProductRequestSummary | null>(null);
  const [items, setItems] = useState<ProductRequestItemDetail[]>([]);
  const [picks, setPicks] = useState<Record<string, PickState>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedRequest(null);
    fetch("/api/product-requests?pageSize=200")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: ProductRequestSummary[] } | null) => {
        setRequests((body?.data ?? []).filter((r) => PICKABLE_STATUSES.has(r.status)));
      });
  }, [open]);

  async function goToItems() {
    if (!selectedRequest) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/product-requests/${selectedRequest.id}`);
      if (!res.ok) return;
      const body = (await res.json()) as { items: ProductRequestItemDetail[] };
      const outstanding = body.items.filter(
        (item) => item.quantityRequested - item.quantityReceived > 0,
      );
      setItems(outstanding);
      setPicks(
        Object.fromEntries(
          outstanding.map((item) => [
            item.id,
            { checked: true, quantity: item.quantityRequested - item.quantityReceived },
          ]),
        ),
      );
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!selectedRequest) return;
    const picked: PickedItem[] = items
      .filter((item) => picks[item.id]?.checked && picks[item.id].quantity > 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: picks[item.id].quantity,
        unitCost: item.expectedUnitCost != null ? Number(item.expectedUnitCost) : undefined,
      }));
    onPicked({
      purchaseOrderId: selectedRequest.id,
      documentNumber: selectedRequest.documentNumber,
      items: picked,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>Pickup</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? "Select a product request"
              : `Items on ${selectedRequest?.documentNumber}`}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {requests.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No sent or partially received product requests to pick up from.
              </p>
            )}
            {requests.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRequest(r)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                  selectedRequest?.id === r.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="font-medium">{r.documentNumber}</span>
                <span className="text-muted-foreground capitalize">
                  {r.status.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            <div className="text-muted-foreground grid grid-cols-[auto_1fr_90px_90px_110px] gap-2 text-xs font-medium">
              <span />
              <span>Product</span>
              <span>Requested</span>
              <span>Received</span>
              <span>Pick qty</span>
            </div>
            {items.map((item) => {
              const outstanding = item.quantityRequested - item.quantityReceived;
              const pick = picks[item.id];
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[auto_1fr_90px_90px_110px] items-center gap-2 rounded-lg border p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={pick?.checked ?? false}
                    onChange={(e) =>
                      setPicks((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], checked: e.target.checked },
                      }))
                    }
                  />
                  <span>{item.productName}</span>
                  <span>{item.quantityRequested}</span>
                  <span>{item.quantityReceived}</span>
                  <Input
                    type="number"
                    min={0}
                    max={outstanding}
                    disabled={!pick?.checked}
                    value={pick?.quantity ?? 0}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(outstanding, Number(e.target.value) || 0));
                      setPicks((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], quantity: value },
                      }));
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button type="button" disabled={!selectedRequest || loading} onClick={goToItems}>
              {loading ? "Loading…" : "Next"}
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={confirm}>
              Add to inward
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
