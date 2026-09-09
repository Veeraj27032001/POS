"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/lib/datetime/format";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface OnlineOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  stockLockId: string | null;
}

interface OnlineOrderPayment {
  id: string;
  method: string;
  reference: string | null;
  amount: string;
}

interface OnlineOrderDetail {
  id: string;
  documentNumber: string;
  status: "pending" | "accepted" | "rejected";
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerTaluk: string | null;
  customerStateName: string | null;
  customerCountryName: string | null;
  customerPincode: string | null;
  rejectionReason: string | null;
  createdAt: string;
  respondedAt: string | null;
  respondedByUser: { name: string } | null;
  items: OnlineOrderItem[];
  payments: OnlineOrderPayment[];
  bill: { id: string; documentNumber: string; grandTotal: string } | null;
}

const STATUS_BADGE = {
  pending: "default",
  accepted: "secondary",
  rejected: "destructive",
} as const;

function RejectDialog({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-kbd-item]" });

  async function submit() {
    if (!reason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/online-orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to reject the order.");
        return;
      }
      toast.success("Order rejected — stock released, customer notified.");
      setOpen(false);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" data-kbd-item="" />}>Reject</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this order</DialogTitle>
        </DialogHeader>
        <div ref={kbdRef} className="contents">
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              data-kbd-item=""
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-muted-foreground text-xs">
              The customer is notified. No invoice is ever created for this order.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" data-kbd-item="" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-kbd-item=""
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? "Rejecting…" : "Reject order"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OnlineOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currencySymbol = useStoreCurrencySymbol();
  const [order, setOrder] = useState<OnlineOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/online-orders/${params.id}`);
      if (res.ok) setOrder(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (!order) return <div className="p-8">Online order not found.</div>;

  const total =
    order.bill?.grandTotal ??
    order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);

  const address = [
    order.customerAddress,
    order.customerCity,
    order.customerTaluk,
    order.customerStateName,
    order.customerCountryName,
    order.customerPincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div ref={kbdRef} className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.documentNumber}</h1>
          <Badge variant={STATUS_BADGE[order.status]} className="mt-1">
            {order.status}
          </Badge>
        </div>
        {order.status === "pending" && (
          <div className="flex gap-2">
            <RejectDialog orderId={order.id} onDone={load} />
            <Button data-kbd-item="" onClick={() => router.push(`/online-orders/${order.id}/bill`)}>
              Accept
            </Button>
          </div>
        )}
        {order.bill && (
          <Link
            href={`/bills/${order.bill.id}`}
            data-kbd-item=""
            className="text-primary text-sm underline"
          >
            View bill {order.bill.documentNumber}
          </Link>
        )}
      </div>

      {order.status === "rejected" && order.rejectionReason && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm">
          <p className="font-medium">
            Rejected{order.respondedByUser ? ` by ${order.respondedByUser.name}` : ""}
          </p>
          <p className="text-muted-foreground">{order.rejectionReason}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{order.customerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{order.customerPhone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{order.customerEmail ?? "—"}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-muted-foreground">Shipping address</dt>
          <dd>{address || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Placed</dt>
          <dd>{formatTimestamp(order.createdAt)}</dd>
        </div>
        {order.respondedAt && (
          <div>
            <dt className="text-muted-foreground">Responded</dt>
            <dd>{formatTimestamp(order.respondedAt)}</dd>
          </div>
        )}
      </dl>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Items</h2>
        <div className="divide-y rounded-lg border">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 text-sm">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>
                {currencySymbol}
                {(Number(item.unitPrice) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between p-3 text-sm font-semibold">
            <span>Total</span>
            <span>
              {currencySymbol}
              {Number(total).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {order.payments.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Payment</h2>
          <div className="divide-y rounded-lg border">
            {order.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {p.method}
                  {p.reference ? ` — ${p.reference}` : ""}
                </span>
                <span>
                  {currencySymbol}
                  {Number(p.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" data-kbd-item="" onClick={() => router.push("/online-orders")}>
        Back to Online Orders
      </Button>
    </div>
  );
}
