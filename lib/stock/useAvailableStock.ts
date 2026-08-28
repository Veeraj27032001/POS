"use client";

import { useEffect, useState } from "react";

export function useAvailableStock(
  warehouseId: string | null | undefined,
  productId: string | null | undefined,
): number | null {
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    if (!warehouseId || !productId) {
      setAvailable(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/stock-levels?warehouseId=${warehouseId}&productId=${productId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { available: number } | null) => {
        if (cancelled) return;
        setAvailable(json?.available ?? null);
      })
      .catch(() => {
        if (!cancelled) setAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, productId]);

  return available;
}
