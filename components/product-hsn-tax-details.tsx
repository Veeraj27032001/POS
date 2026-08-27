"use client";

import { useEffect, useState } from "react";

import { useOptionsList } from "@/lib/masters/useOptionsList";

interface HsnRatesRow {
  hsnCode: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
}

export function ProductHsnTaxDetails({ taxCodeId }: { taxCodeId: string | null | undefined }) {
  const [displayEnabled, setDisplayEnabled] = useState(false);
  const taxCodes = useOptionsList("tax-codes", "code");
  const [rates, setRates] = useState<HsnRatesRow | null>(null);

  useEffect(() => {
    fetch("/api/tax-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { hsnTaxDisplayEnabled: boolean } | null) =>
        setDisplayEnabled(body?.hsnTaxDisplayEnabled ?? false),
      );
  }, []);

  useEffect(() => {
    if (!displayEnabled || !taxCodeId || taxCodes.length === 0) {
      setRates(null);
      return;
    }
    const code = taxCodes.find((t) => t.value === taxCodeId)?.label;
    if (!code) {
      setRates(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/hsn-codes?search=${encodeURIComponent(code)}&pageSize=10`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: HsnRatesRow[] } | null) => {
        if (cancelled) return;
        setRates(body?.data.find((h) => h.hsnCode === code) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [displayEnabled, taxCodeId, taxCodes]);

  if (!displayEnabled || !rates) return null;

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
