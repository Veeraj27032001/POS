"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SendLinkPanel } from "@/components/billing/send-link-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getPrintBridge } from "@/lib/adapters/print";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

type UiMethod = "qr_link" | "card_machine";

interface BillInfo {
  id: string;
  documentNumber: string;
  status: string;
  grandTotal: string;
  payments: { amount: string; status: string }[];
  customer: { email: string | null; phone: string | null } | null;
}

interface CreateResponse {
  id: string;
  status: string;
  amount: number;
  gatewayReference: string | null;
  presentationValue: string;
  qrImageDataUrl?: string;
  deliverySent?: boolean;
}

interface StatusResponse {
  id: string;
  status: string;
}

const UI_METHOD_LABELS: Record<UiMethod, string> = {
  qr_link: "QR / Link",
  card_machine: "Card Machine",
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

export default function CollectGatewayPaymentPage() {
  const { billId } = useParams<{ billId: string }>();
  const router = useRouter();
  const currencySymbol = useStoreCurrencySymbol();

  const [bill, setBill] = useState<BillInfo | null | undefined>(undefined);
  const [uiMethod, setUiMethod] = useState<UiMethod>("qr_link");
  const [requesting, setRequesting] = useState(false);
  const [request, setRequest] = useState<CreateResponse | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [paused, setPaused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [clearingStale, setClearingStale] = useState(true);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function loadBill() {
    fetch(`/api/bills/${billId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setBill);
  }

  useEffect(loadBill, [billId]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/bills/${billId}/payment-requests`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then(async (body: { data: { id: string; status: string }[] }) => {
        const stale = body.data.filter((r) => r.status === "pending");
        await Promise.all(
          stale.map((r) =>
            fetch(`/api/payment-requests/${r.id}/cancel`, { method: "POST" }).catch(() => {}),
          ),
        );
        if (!ignore) setClearingStale(false);
      })
      .catch(() => {
        if (!ignore) setClearingStale(false);
      });
    return () => {
      ignore = true;
    };
  }, [billId]);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }
  useEffect(() => stopPolling, []);

  async function pollOnce(id: string) {
    const res = await fetch(`/api/payment-requests/${id}`);
    if (!res.ok) return;
    const body = (await res.json()) as StatusResponse;
    setStatus(body.status);
    if (body.status === "paid") {
      stopPolling();
      toast.success("Payment received.");
      setPaymentDone(true);
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

  async function requestPayment(m: UiMethod) {
    setRequesting(true);
    try {
      const res = await fetch(`/api/bills/${billId}/payment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: m === "qr_link" ? "qr_code" : "card_machine" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to start the payment request.");
        return;
      }
      const body = (await res.json()) as CreateResponse;
      setRequest(body);
      setStatus(body.status);
      if (m === "qr_link") startPolling(body.id);
      else if (m === "card_machine") void tryHardwareCardCharge(body);
    } finally {
      setRequesting(false);
    }
  }

  // QR/Link starts sharing immediately, with no separate "Request payment"
  // click — only Card Machine needs an explicit action.
  useEffect(() => {
    if (clearingStale || !bill || request || requesting) return;
    if (uiMethod === "qr_link") void requestPayment(uiMethod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearingStale, bill, uiMethod, request, requesting]);

  // Accepts an explicit request so the hardware auto-charge path below can
  // pass the just-created request without waiting on the setRequest state
  // update to flush — the manual "Mark as paid" button keeps calling this
  // with no argument, falling back to the current request state as before.
  async function confirmCardMachine(req: CreateResponse | null = request) {
    if (!req) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/payment-requests/${req.id}/confirm`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to confirm the payment.");
        return;
      }
      toast.success("Payment received.");
      setPaymentDone(true);
    } finally {
      setConfirming(false);
    }
  }

  // Best-effort: only proceeds when a desktop bridge with chargeCard is
  // present. On "success" it auto-confirms via the same route the manual
  // "Mark as paid" button calls; anything else (including no bridge at
  // all, e.g. a plain browser tab) leaves that button as the only path —
  // no toast here, since this is a silent background attempt, not a
  // user-initiated action.
  async function tryHardwareCardCharge(req: CreateResponse) {
    const chargeCard = getPrintBridge().chargeCard;
    if (!chargeCard || !req.gatewayReference) return;
    try {
      const result = await chargeCard(req.amount, {
        requestId: req.id,
        gatewayReference: req.gatewayReference,
        currency: "INR",
      });
      if (result.status === "success") {
        await confirmCardMachine(req);
      }
    } catch {
      // Hardware charge attempt failed — the cashier confirms manually
      // once the physical terminal approves.
    }
  }

  function reset(nextMethod: UiMethod) {
    stopPolling();
    setRequest(null);
    setStatus("pending");
    setPaused(false);
    setUiMethod(nextMethod);
  }

  async function cancelRequest() {
    stopPolling();
    if (request && status === "pending") {
      await fetch(`/api/payment-requests/${request.id}/cancel`, { method: "POST" }).catch(() => {});
    }
  }

  async function switchMethod(nextMethod: UiMethod) {
    await cancelRequest();
    reset(nextMethod);
  }

  async function cancelAndGoBack() {
    await cancelRequest();
    router.push("/billing");
  }

  if (bill === undefined || clearingStale) {
    return <p className="text-muted-foreground p-8 text-sm">Loading…</p>;
  }
  if (bill === null) {
    return <p className="text-muted-foreground p-8 text-sm">Bill not found.</p>;
  }

  const totalPaid = bill.payments
    .filter((p) => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(bill.grandTotal) - totalPaid);

  if (paymentDone || remaining <= 0.01) {
    return (
      <div ref={kbdRef} className="space-y-4 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Payment received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Document number: </span>
              {bill.documentNumber}
            </p>
            <p>
              <span className="text-muted-foreground">Grand total: </span>
              {currencySymbol}
              {Number(bill.grandTotal).toFixed(2)}
            </p>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              data-kbd-item=""
              variant="outline"
              onClick={() => router.push(`/bills/${billId}`)}
            >
              View bill
            </Button>
            <Button data-kbd-item="" onClick={() => router.push("/billing")}>
              Start new bill
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <button
        type="button"
        data-kbd-item=""
        onClick={() => void cancelAndGoBack()}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to billing
      </button>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Collect Payment</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <p className="text-lg font-semibold">
              {currencySymbol}
              {remaining.toFixed(2)}
            </p>
            <p className="text-muted-foreground text-xs">{bill.documentNumber}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <div className="flex gap-2">
              {(Object.keys(UI_METHOD_LABELS) as UiMethod[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  data-kbd-item=""
                  variant={uiMethod === m ? "default" : "outline"}
                  onClick={() => void switchMethod(m)}
                >
                  {UI_METHOD_LABELS[m]}
                </Button>
              ))}
            </div>
          </div>

          {!request && uiMethod === "card_machine" && (
            <p className="text-muted-foreground text-sm">Click Request payment to begin.</p>
          )}
          {!request && uiMethod === "qr_link" && (
            <p className="text-muted-foreground text-sm">Generating…</p>
          )}

          {request && (
            <>
              {uiMethod === "qr_link" &&
                request.presentationValue &&
                (request.presentationValue.startsWith("data:") ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={request.presentationValue}
                      alt="Scan to pay"
                      className="size-48 rounded-md border"
                    />
                    <p className="text-muted-foreground text-xs">
                      Ask the customer to scan and pay.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {request.qrImageDataUrl && (
                      <div className="flex flex-col items-center gap-2 pb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={request.qrImageDataUrl}
                          alt="Scan to open the pay page"
                          className="size-48 rounded-md border"
                        />
                        <p className="text-muted-foreground text-xs">
                          Scan to open the pay page directly.
                        </p>
                      </div>
                    )}
                    <Label>Link</Label>
                    <div className="flex gap-2">
                      <p className="bg-muted flex-1 truncate rounded-md border px-2 py-1.5 text-xs">
                        {request.presentationValue}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-kbd-item=""
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
                      amount={remaining}
                      currencySymbol={currencySymbol}
                      defaultEmail={bill.customer?.email ?? undefined}
                      defaultPhone={bill.customer?.phone ?? undefined}
                    />
                  </div>
                ))}
              {uiMethod === "card_machine" && (
                <p className="text-sm">Waiting for the card machine — confirm once it approves.</p>
              )}

              {status === "expired" ? (
                <p className="text-destructive text-sm">This request expired.</p>
              ) : uiMethod !== "card_machine" ? (
                <p className="text-muted-foreground text-sm">
                  {paused ? "Still waiting — check again, or cancel." : "Waiting for payment…"}
                </p>
              ) : null}
            </>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            data-kbd-item=""
            onClick={() => void cancelAndGoBack()}
          >
            Cancel
          </Button>
          {!request && uiMethod === "card_machine" && (
            <Button
              type="button"
              data-kbd-item=""
              onClick={() => void requestPayment(uiMethod)}
              disabled={requesting}
            >
              {requesting ? "Requesting…" : "Request payment"}
            </Button>
          )}
          {request && status === "expired" && (
            <Button
              type="button"
              variant="outline"
              data-kbd-item=""
              onClick={() => reset(uiMethod)}
            >
              Try again
            </Button>
          )}
          {request && paused && status === "pending" && uiMethod !== "card_machine" && (
            <Button
              type="button"
              variant="outline"
              data-kbd-item=""
              onClick={() => startPolling(request.id)}
            >
              Check now
            </Button>
          )}
          {request && uiMethod === "card_machine" && status === "pending" && (
            <Button
              type="button"
              data-kbd-item=""
              onClick={() => void confirmCardMachine()}
              disabled={confirming}
            >
              {confirming ? "Confirming…" : "Mark as paid"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
