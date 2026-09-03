"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SendLinkPanel } from "@/components/billing/send-link-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";

type GatewayMethod = "qr_code" | "payment_link" | "card_machine";

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

export default function CollectGatewayPaymentPage() {
  const { billId } = useParams<{ billId: string }>();
  const router = useRouter();
  const currencySymbol = useStoreCurrencySymbol();

  const [bill, setBill] = useState<BillInfo | null | undefined>(undefined);
  const [method, setMethod] = useState<GatewayMethod>("qr_code");
  const [requesting, setRequesting] = useState(false);
  const [request, setRequest] = useState<CreateResponse | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [paused, setPaused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [clearingStale, setClearingStale] = useState(true);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setPaymentDone(true);
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

  async function cancelRequest() {
    stopPolling();
    if (request && status === "pending") {
      await fetch(`/api/payment-requests/${request.id}/cancel`, { method: "POST" }).catch(() => {});
    }
  }

  async function switchMethod() {
    await cancelRequest();
    reset();
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
      <div className="space-y-4 p-8">
        <Card className="max-w-md">
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
            <Button variant="outline" onClick={() => router.push(`/bills/${billId}`)}>
              View bill
            </Button>
            <Button onClick={() => router.push("/billing")}>Start new bill</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-8">
      <button
        type="button"
        onClick={() => void cancelAndGoBack()}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to billing
      </button>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Collect Payment</CardTitle>
        </CardHeader>

        {!request && (
          <>
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
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => void cancelAndGoBack()}>
                Back
              </Button>
              <Button type="button" onClick={() => void requestPayment()} disabled={requesting}>
                {requesting ? "Requesting…" : "Request payment"}
              </Button>
            </CardFooter>
          </>
        )}

        {request && (
          <>
            <CardContent className="space-y-3">
              {(method === "qr_code" || method === "payment_link") &&
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
                      amount={remaining}
                      currencySymbol={currencySymbol}
                      defaultEmail={bill.customer?.email ?? undefined}
                      defaultPhone={bill.customer?.phone ?? undefined}
                    />
                  </div>
                ))}
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
            </CardContent>

            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => void cancelAndGoBack()}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => void switchMethod()}>
                Switch method
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
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
