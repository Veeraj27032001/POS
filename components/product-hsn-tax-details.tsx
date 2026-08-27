"use client";

import { useEffect, useState } from "react";

import { useTaxPreferences } from "@/lib/masters/useTaxPreferences";

interface HsnRatesRow {
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
}

export function ProductHsnTaxDetails({ hsnCodeId }: { hsnCodeId: string | null | undefined }) {
  const preferences = useTaxPreferences();
  const [rates, setRates] = useState<HsnRatesRow | null>(null);

  useEffect(() => {
    if (!preferences?.hsnTaxDisplayEnabled || !hsnCodeId) {
      setRates(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/hsn-codes/${hsnCodeId}/rates`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: HsnRatesRow | null) => {
        if (!cancelled) setRates(body);
      });
    return () => {
      cancelled = true;
    };
  }, [preferences, hsnCodeId]);

  if (!preferences?.hsnTaxDisplayEnabled || !rates) return null;

  return (
    <div className="bg-muted/40 grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm sm:col-span-2">
      <div>
        <div className="text-muted-foreground text-xs">CGST</div>
        <div className="font-medium">{rates.cgstRate}%</div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">SGST</div>
        <div className="font-medium">{rates.sgstRate}%</div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">IGST</div>
        <div className="font-medium">{rates.igstRate}%</div>
      </div>
    </div>
  );
}
