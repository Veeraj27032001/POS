"use client";

import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PayInfo {
  documentNumber: string;
  storeName: string;
  amount: number;
  method: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  bill: {
    documentNumber: string;
    grandTotal: number;
    taxTotal: number;
    discountTotal: number;
    lines: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
  };
}

export default function PayPage() {
  const { reference } = useParams<{ reference: string }>();
  const [info, setInfo] = useState<PayInfo | null | undefined>(undefined);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/pay/${reference}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }

  useEffect(load, [reference]);

  async function payNow() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/${reference}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Failed to complete the payment.");
        return;
      }
      load();
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        {info === undefined && (
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Loading…
          </CardContent>
        )}
        {info === null && (
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <XCircleIcon className="text-destructive size-10" />
            <p className="font-medium">This payment link is invalid.</p>
          </CardContent>
        )}
        {info && (
          <>
            <CardHeader>
              <CardTitle className="text-center text-lg">{info.storeName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center">
              <p className="text-muted-foreground text-sm">{info.documentNumber}</p>

              {info.bill.lines.length > 0 && (
                <div className="w-full space-y-1 rounded-md border p-3 text-left text-sm">
                  {info.bill.lines.map((line, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {line.productName} × {line.quantity}
                      </span>
                      <span>₹{line.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                  {info.bill.discountTotal > 0 && (
                    <div className="flex justify-between gap-3 border-t pt-1">
                      <span className="text-muted-foreground">Discount</span>
                      <span>−₹{info.bill.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {info.bill.taxTotal > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Tax</span>
                      <span>₹{info.bill.taxTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-t pt-1 font-medium">
                    <span>Bill total</span>
                    <span>₹{info.bill.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-xs">Amount due now</p>
                <p className="text-3xl font-bold">₹{info.amount.toFixed(2)}</p>
              </div>

              {info.status === "paid" && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <CheckCircle2Icon className="text-success size-10" />
                  <p className="font-medium">Payment received. Thank you!</p>
                </div>
              )}
              {info.status === "expired" && (
                <p className="text-destructive text-sm">This payment request has expired.</p>
              )}
              {info.status === "cancelled" && (
                <p className="text-destructive text-sm">This payment request was cancelled.</p>
              )}
              {info.status === "pending" && (
                <>
                  <Button className="w-full" onClick={() => void payNow()} disabled={paying}>
                    {paying ? "Processing…" : "Pay Now"}
                  </Button>
                  {error && <p className="text-destructive text-xs">{error}</p>}
                </>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
