"use client";

import { useCallback, useEffect, useState } from "react";

export interface ProductSupplierPriceRow {
  id: string;
  productId: string;
  supplierId: string;
  cost: string;
  createdAt: string;
}

export function useProductSupplierPrices(productId: string | null | undefined) {
  const [prices, setPrices] = useState<ProductSupplierPriceRow[]>([]);

  const refresh = useCallback(() => {
    if (!productId) {
      setPrices([]);
      return;
    }
    fetch(`/api/products/${productId}/supplier-prices`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: ProductSupplierPriceRow[] } | null) => setPrices(body?.data ?? []));
  }, [productId]);

  useEffect(refresh, [refresh]);

  return { prices, refresh };
}
