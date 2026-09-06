"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatTimestamp } from "@/lib/datetime/format";

interface StorefrontOrder {
  id: string;
  documentNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  lines: { productName: string; quantity: number; lineTotal: number }[];
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<StorefrontOrder[] | null>(null);

  useEffect(() => {
    fetch("/api/storefront/orders")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/shop/login?next=/shop/orders");
          return null;
        }
        return res.json();
      })
      .then((body: { orders: StorefrontOrder[] } | null) => setOrders(body?.orders ?? []))
      .catch(() => setOrders([]));
  }, [router]);

  if (orders === null) return <p className="text-muted-foreground">Loading…</p>;

  if (orders.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground">You haven&apos;t placed any orders yet.</p>
        <Link href="/shop" className="text-primary mt-2 inline-block hover:underline">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My orders</h1>
      {orders.map((order) => (
        <div key={order.id} className="rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div>
              <p className="font-medium">{order.documentNumber}</p>
              <p className="text-muted-foreground text-xs">{formatTimestamp(order.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">₹{order.grandTotal.toFixed(2)}</p>
              <p className="text-muted-foreground text-xs capitalize">{order.status}</p>
            </div>
          </div>
          <div className="divide-y text-sm">
            {order.lines.map((line, i) => (
              <div key={i} className="flex justify-between p-3">
                <span>
                  {line.productName} × {line.quantity}
                </span>
                <span>₹{line.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
