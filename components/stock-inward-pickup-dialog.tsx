"use client";

import { Loader2Icon } from "lucide-react";
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
import { PRODUCT_REQUEST_STATUS_LABELS } from "@/lib/documents/productRequestStatus";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
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
    supplierId: string;
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
  const kbdRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-kbd-item]" });

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
      supplierId: selectedRequest.supplierId,
      items: picked,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" data-kbd-item="" />}>
        Pickup
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? "Select a product request"
              : `Items on ${selectedRequest?.documentNumber}`}
          </DialogTitle>
        </DialogHeader>

        <div ref={kbdRef} className="contents">
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
                  data-kbd-item=""
                  onClick={() => setSelectedRequest(r)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                    selectedRequest?.id === r.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="font-medium">{r.documentNumber}</span>
                  <span className="text-muted-foreground">
                    {PRODUCT_REQUEST_STATUS_LABELS[r.status] ?? r.status}
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
                      data-kbd-item=""
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
                      data-kbd-item=""
                      disabled={!pick?.checked}
                      value={pick?.quantity ?? 0}
                      onChange={(e) => {
                        const value = Math.max(
                          0,
                          Math.min(outstanding, Number(e.target.value) || 0),
                        );
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
              <Button type="button" variant="outline" data-kbd-item="" onClick={() => setStep(1)}>
                Back
              </Button>
            )}
            {step === 1 && (
              <Button
                type="button"
                data-kbd-item=""
                disabled={!selectedRequest || loading}
                onClick={goToItems}
              >
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : "Next"}
              </Button>
            )}
            {step === 2 && (
              <Button type="button" data-kbd-item="" onClick={confirm}>
                Add to inward
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
