"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/storefront/useCart";

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();

  if (!cart.loaded) return <p className="text-muted-foreground">Loading…</p>;

  if (cart.lines.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link href="/shop" className="text-primary mt-2 inline-block hover:underline">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Your cart</h1>
      <div className="divide-y rounded-lg border">
        {cart.lines.map((line) => (
          <div key={line.productId} className="flex items-center gap-3 p-3">
            <div className="bg-secondary size-14 shrink-0 overflow-hidden rounded">
              {line.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.image} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.name}</p>
              <p className="text-muted-foreground text-sm">₹{line.price.toFixed(2)}</p>
            </div>
            <Input
              type="number"
              min={0}
              value={line.quantity}
              onChange={(e) =>
                cart.setQuantity(line.productId, Math.max(0, Number(e.target.value)))
              }
              className="w-20"
            />
            <p className="w-20 text-right text-sm font-medium">
              ₹{(line.price * line.quantity).toFixed(2)}
            </p>
            <Button variant="ghost" size="sm" onClick={() => cart.removeItem(line.productId)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-lg font-semibold">Total: ₹{cart.total.toFixed(2)}</p>
        <Button onClick={() => router.push("/shop/checkout")}>Checkout</Button>
      </div>
    </div>
  );
}
