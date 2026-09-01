"use client";

import { useEffect, useState } from "react";

// Whether the signed-in user's own store defaults new bills to tax-excluded
// — used to pre-check the Exclude Tax checkbox when starting a fresh bill.
export function useStoreDefaultExcludeTax(): boolean {
  const [defaultExcludeTax, setDefaultExcludeTax] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stores/defaults")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { defaultExcludeTax?: boolean } | null) => {
        if (!cancelled && body?.defaultExcludeTax) setDefaultExcludeTax(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return defaultExcludeTax;
}
