"use client";

import { useCallback, useEffect, useState } from "react";

export interface CartLine {
  productId: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
}

const STORAGE_KEY = "storefront:cart";

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private browsing / storage disabled — the cart just won't persist.
  }
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLines(readCart());
    setLoaded(true);
  }, []);

  const update = useCallback((next: CartLine[]) => {
    setLines(next);
    writeCart(next);
  }, []);

  const addItem = useCallback((item: Omit<CartLine, "quantity">, quantity: number) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === item.productId);
      const next = existing
        ? prev.map((l) =>
            l.productId === item.productId ? { ...l, quantity: l.quantity + quantity } : l,
          )
        : [...prev, { ...item, quantity }];
      writeCart(next);
      return next;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) => {
      const next =
        quantity <= 0
          ? prev.filter((l) => l.productId !== productId)
          : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l));
      writeCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.productId !== productId);
      writeCart(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => update([]), [update]);

  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return { lines, loaded, addItem, setQuantity, removeItem, clear, total };
}
