"use client";

import { useEffect, useState } from "react";

// Whether QR / payment link / card machine collection is available at all
// for the signed-in user's store — false while loading, so the "Collect
// via…" button only appears once we know it's actually usable.
export function useStorePaymentGatewayAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stores/defaults")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { paymentGatewayAvailable?: boolean } | null) => {
        if (!cancelled && body?.paymentGatewayAvailable) setAvailable(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
