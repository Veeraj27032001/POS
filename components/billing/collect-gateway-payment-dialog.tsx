"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SendLinkPanel } from "@/components/billing/send-link-panel";
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

type GatewayMethod = "qr_code" | "payment_link" | "card_machine";

interface CreateResponse {
  id: string;
  status: string;
  presentationValue: string;
  deliverySent?: boolean;
}

interface StatusResponse {
  id: string;
  status: string;
}

const METHOD_LABELS: Record<GatewayMethod, string> = {
  qr_code: "QR Code",
  payment_link: "Payment Link",
  card_machine: "Card Machine",
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

export function CollectGatewayPaymentDialog({
  billId,
  amount,
  currencySymbol,
  onPaid,
  triggerLabel = "Collect via QR / Link / Card",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  hideTrigger = false,
  customerEmail,
  customerPhone,
}: {
  billId: string;
  amount: number;
  currencySymbol: string;
  onPaid: () => void;
  triggerLabel?: string;
  /** Pass to drive the dialog open state externally (e.g. syncing the bill
   * before it can open) instead of the built-in trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in trigger button — used together with the controlled
   * open props above. */
  hideTrigger?: boolean;
  /** Pre-fills the send-link panel when known. */
  customerEmail?: string;
  customerPhone?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [method, setMethod] = useState<GatewayMethod>("qr_code");
  const [requesting, setRequesting] = useState(false);
  const [request, setRequest] = useState<CreateResponse | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [paused, setPaused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function pollOnce(id: string) {
    const res = await fetch(`/api/payment-requests/${id}`);
    if (!res.ok) return;
    const body = (await res.json()) as StatusResponse;
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

  useEffect(() => stopPolling, []);

  async function requestPayment() {
    setRequesting(true);
    try {
      const res = await fetch(`/api/bills/${billId}/payment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to start the payment request.");
        return;
      }
      const body = (await res.json()) as CreateResponse;
      setRequest(body);
      setStatus(body.status);
      if (method !== "card_machine") startPolling(body.id);
    } finally {
      setRequesting(false);
    }
  }

  async function confirmCardMachine() {
    if (!request) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/payment-requests/${request.id}/confirm`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to confirm the payment.");
        return;
      }
      toast.success("Payment received.");
      onPaid();
      reset();
      setOpen(false);
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    stopPolling();
    setRequest(null);
    setStatus("pending");
    setPaused(false);
    setMethod("qr_code");
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
      {!hideTrigger && (
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          {triggerLabel}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
        </DialogHeader>

        {!request && (
          <>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <p className="text-lg font-semibold">
                {currencySymbol}
                {amount.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <div className="flex gap-2">
                {(Object.keys(METHOD_LABELS) as GatewayMethod[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={method === m ? "default" : "outline"}
                    onClick={() => setMethod(m)}
                  >
                    {METHOD_LABELS[m]}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Back
              </Button>
              <Button type="button" onClick={() => void requestPayment()} disabled={requesting}>
                {requesting ? "Requesting…" : "Request payment"}
              </Button>
            </DialogFooter>
          </>
        )}

        {request && status !== "paid" && (
          <div className="space-y-3">
            {method === "qr_code" && request.presentationValue && (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={request.presentationValue}
                  alt="Scan to pay"
                  className="size-48 rounded-md border"
                />
                <p className="text-muted-foreground text-xs">Ask the customer to scan and pay.</p>
              </div>
            )}
            {method === "payment_link" && (
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
                <SendLinkPanel
                  link={request.presentationValue}
                  amount={amount}
                  currencySymbol={currencySymbol}
                  defaultEmail={customerEmail}
                  defaultPhone={customerPhone}
                />
              </div>
            )}
            {method === "card_machine" && (
              <p className="text-sm">Waiting for the card machine — confirm once it approves.</p>
            )}

            {status === "expired" ? (
              <p className="text-destructive text-sm">This request expired.</p>
            ) : method !== "card_machine" ? (
              <p className="text-muted-foreground text-sm">
                {paused ? "Still waiting — check again, or cancel." : "Waiting for payment…"}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void cancelAndClose()}>
                Cancel
              </Button>
              {status === "expired" && (
                <Button type="button" variant="outline" onClick={reset}>
                  Try again
                </Button>
              )}
              {paused && status === "pending" && method !== "card_machine" && (
                <Button type="button" variant="outline" onClick={() => startPolling(request.id)}>
                  Check now
                </Button>
              )}
              {method === "card_machine" && status === "pending" && (
                <Button
                  type="button"
                  onClick={() => void confirmCardMachine()}
                  disabled={confirming}
                >
                  {confirming ? "Confirming…" : "Mark as paid"}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
