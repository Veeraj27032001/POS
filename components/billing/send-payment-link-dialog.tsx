"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateResponse {
  id: string;
  status: string;
  presentationValue: string;
  deliverySent?: boolean;
  devSimulateAvailable: boolean;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

export function SendPaymentLinkDialog({
  billId,
  maxAmount,
  currencySymbol,
  onPaid,
}: {
  billId: string;
  maxAmount: number;
  currencySymbol: string;
  onPaid: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => maxAmount.toFixed(2));
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "sms">("sms");
  const [sending, setSending] = useState(false);
  const [request, setRequest] = useState<CreateResponse | null>(null);
  const [status, setStatus] = useState("pending");
  const [paused, setPaused] = useState(false);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function reset() {
    stopPolling();
    setRequest(null);
    setStatus("pending");
    setPaused(false);
    setAmount(maxAmount.toFixed(2));
  }

  async function pollOnce(id: string) {
    const res = await fetch(`/api/payment-requests/${id}`);
    if (!res.ok) return;
    const body = (await res.json()) as { status: string };
    setStatus(body.status);
    if (body.status === "paid") {
      stopPolling();
      toast.success("Payment received.");
      onPaid();
      reset();
      setOpen(false);
    } else if (body.status === "expired" || body.status === "cancelled") {
      stopPolling();
    } else {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        stopPolling();
        setPaused(true);
      }
    }
  }

  function startPolling(id: string) {
    pollCountRef.current = 0;
    setPaused(false);
    intervalRef.current = setInterval(() => void pollOnce(id), POLL_INTERVAL_MS);
  }

  async function send() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/bills/${billId}/payment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "payment_link", amount: numericAmount, deliveryChannel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to send the payment link.");
        return;
      }
      const body = (await res.json()) as CreateResponse;
      setRequest(body);
      setStatus(body.status);
      startPolling(body.id);
    } finally {
      setSending(false);
    }
  }

  async function simulate(action: "markPaid" | "markExpired") {
    if (!request) return;
    const res = await fetch(`/api/payment-requests/${request.id}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { status: string };
    setStatus(body.status);
    if (body.status === "paid") {
      stopPolling();
      toast.success("Payment received (simulated).");
      onPaid();
      reset();
      setOpen(false);
    } else if (body.status === "expired") {
      stopPolling();
    }
  }

  async function cancelAndClose() {
    stopPolling();
    if (request && status === "pending") {
      await fetch(`/api/payment-requests/${request.id}/cancel`, { method: "POST" }).catch(() => {});
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void cancelAndClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Send payment link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Payment Link</DialogTitle>
        </DialogHeader>

        {!request && (
          <>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                max={maxAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Up to {currencySymbol}
                {maxAmount.toFixed(2)}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Send via</Label>
              <Select
                value={deliveryChannel}
                onValueChange={(v) => v && setDeliveryChannel(v as "email" | "sms")}
                items={[
                  { value: "sms", label: "SMS" },
                  { value: "email", label: "Email" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Back
              </Button>
              <Button type="button" onClick={() => void send()} disabled={sending}>
                {sending ? "Sending…" : "Send link"}
              </Button>
            </DialogFooter>
          </>
        )}

        {request && status !== "paid" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Link</Label>
              <div className="flex gap-2">
                <p className="bg-muted flex-1 truncate rounded-md border px-2 py-1.5 text-xs">
                  {request.presentationValue}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(request.presentationValue);
                    toast.success("Link copied.");
                  }}
                >
                  Copy
                </Button>
              </div>
              {request.deliverySent === false && (
                <p className="text-muted-foreground text-xs">
                  Couldn&apos;t send it automatically — copy and share it manually.
                </p>
              )}
              {request.deliverySent === true && (
                <p className="text-muted-foreground text-xs">Sent to the customer.</p>
              )}
            </div>

            {status === "expired" ? (
              <p className="text-destructive text-sm">This request expired.</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {paused ? "Still waiting — check again, or cancel." : "Waiting for payment…"}
              </p>
            )}

            {request.devSimulateAvailable && status === "pending" && (
              <div className="flex gap-2 border-t pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void simulate("markPaid")}
                >
                  Simulate: mark as paid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void simulate("markExpired")}
                >
                  Simulate: mark expired
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void cancelAndClose()}>
                Cancel
              </Button>
              {status === "expired" && (
                <Button type="button" variant="outline" onClick={reset}>
                  Try again
                </Button>
              )}
              {paused && status === "pending" && (
                <Button type="button" variant="outline" onClick={() => startPolling(request.id)}>
                  Check now
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
