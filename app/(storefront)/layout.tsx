"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface StorefrontCustomer {
  id: string;
  name: string | null;
  phone: string | null;
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<StorefrontCustomer | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/storefront/me")
      .then((res) => res.json())
      .then((body: { customer: StorefrontCustomer | null }) => setCustomer(body.customer))
      .catch(() => setCustomer(null));
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/shop" className="text-lg font-bold whitespace-nowrap">
            The Store
          </Link>
          <div className="hidden flex-1 sm:block" />
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/shop/cart" className="hover:underline">
              Cart
            </Link>
            <Link href="/shop/orders" className="hover:underline">
              My Orders
            </Link>
            {customer ? (
              <Link href="/shop/account" className="hover:underline">
                {customer.name ?? customer.phone}
              </Link>
            ) : (
              <Link href="/shop/login" className="hover:underline">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
