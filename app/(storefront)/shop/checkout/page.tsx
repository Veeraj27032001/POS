"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/storefront/useCart";

interface StorefrontCustomer {
  id: string;
  name: string | null;
  phone: string | null;
}

type Step = "review" | "locking" | "payment" | "placing";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const [customer, setCustomer] = useState<StorefrontCustomer | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("review");
  const [locks, setLocks] = useState<{ productId: string; quantity: number; lockId: string }[]>([]);

  useEffect(() => {
    fetch("/api/storefront/me")
      .then((res) => res.json())
      .then((body: { customer: StorefrontCustomer | null }) => {
        setCustomer(body.customer);
        if (!body.customer) router.replace("/shop/login?next=/shop/checkout");
      });
  }, [router]);

  // Reserves stock for every cart line before payment — validates qty
  // against real, live availability (POST /v1/ecommerce/stock-lock under
  // the hood). Any failure releases whatever locks already succeeded, so a
  // half-reserved cart never sits around holding stock hostage.
  async function reserveStock() {
    setStep("locking");
    const acquired: { productId: string; quantity: number; lockId: string }[] = [];

    for (const line of cart.lines) {
      const res = await fetch("/api/storefront/cart/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: line.productId, quantity: line.quantity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(
          `${line.name}: ${body?.error?.message ?? "couldn't reserve stock"} — releasing the rest.`,
        );
        for (const lock of acquired) {
          await fetch("/api/storefront/cart/release", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lockId: lock.lockId }),
          });
        }
        setStep("review");
        return;
      }
      const body = await res.json();
      acquired.push({ productId: line.productId, quantity: line.quantity, lockId: body.lockId });
    }

    setLocks(acquired);
    setStep("payment");
  }

  // The fake gateway — this app's real e-commerce API deliberately stays
  // out of payment (see the integration guide); this is just the storefront
  // demo standing in for whatever real processor a merchant would use.
  async function payNow() {
    setStep("placing");
    const res = await fetch("/api/storefront/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: locks.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          stockLockId: l.lockId,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to place the order.");
      setStep("payment");
      return;
    }
    const bill = await res.json();
    cart.clear();
    toast.success(`Order ${bill.documentNumber} placed.`);
    router.push("/shop/orders");
  }

  async function cancelPayment() {
    for (const lock of locks) {
      await fetch("/api/storefront/cart/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockId: lock.lockId }),
      });
    }
    setLocks([]);
    toast("Payment cancelled — stock released.");
    setStep("review");
  }

  if (customer === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (!customer) return null;
  if (cart.loaded && cart.lines.length === 0 && step === "review") {
    return <p className="text-muted-foreground">Your cart is empty.</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-xl font-bold">Checkout</h1>

      <div className="divide-y rounded-lg border text-sm">
        {cart.lines.map((line) => (
          <div key={line.productId} className="flex justify-between p-3">
            <span>
              {line.name} × {line.quantity}
            </span>
            <span>₹{(line.price * line.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between p-3 font-semibold">
          <span>Total</span>
          <span>₹{cart.total.toFixed(2)}</span>
        </div>
      </div>

      {step === "review" && (
        <Button className="w-full" onClick={() => void reserveStock()}>
          Reserve &amp; continue to payment
        </Button>
      )}

      {step === "locking" && <p className="text-muted-foreground text-center">Reserving stock…</p>}

      {step === "payment" && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Payment</p>
          <p className="text-muted-foreground text-sm">
            Demo gateway — this app&apos;s e-commerce API never handles real payment.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void payNow()}>
              Pay ₹{cart.total.toFixed(2)}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => void cancelPayment()}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "placing" && (
        <p className="text-muted-foreground text-center">Placing your order…</p>
      )}
    </div>
  );
}
