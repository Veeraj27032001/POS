"use client";

import { useEffect, useState } from "react";

interface TaxPreferences {
  id: string;
  hsnTaxDisplayEnabled: boolean;
  autoApplyTaxByDefault: boolean;
}

export function useTaxPreferences(): TaxPreferences | undefined {
  const [preferences, setPreferences] = useState<TaxPreferences | undefined>(undefined);

  useEffect(() => {
    fetch("/api/tax-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then(setPreferences);
  }, []);

  return preferences;
}
