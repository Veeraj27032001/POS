"use client";

import { useEffect, useState } from "react";

const FALLBACK_CURRENCY_SYMBOL = "₹";

// The symbol for the signed-in user's own store's configured currency —
// falls back to ₹ if the store has no currency set (or for a Super Admin
// session, which has no single store).
export function useStoreCurrencySymbol(): string {
  const [symbol, setSymbol] = useState(FALLBACK_CURRENCY_SYMBOL);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stores/defaults")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { currencySymbol?: string } | null) => {
        if (!cancelled && body?.currencySymbol) setSymbol(body.currencySymbol);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return symbol;
}
