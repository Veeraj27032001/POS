"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asAppSession } from "@/lib/auth/types";

interface FinancialYearOption {
  id: string;
  label: string;
}

export function FinancialYearSwitcher() {
  const { data, update } = useSession();
  const session = asAppSession(data ?? null);
  const [options, setOptions] = useState<FinancialYearOption[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/financial-years")
      .then((res) => res.json())
      .then((json: { financialYears: FinancialYearOption[] }) => setOptions(json.financialYears))
      .catch(() => setOptions([]));
  }, []);

  async function handleChange(financialYearId: string | null) {
    if (!financialYearId) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/financial-year/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financialYearId }),
      });
      if (!res.ok) return;
      await update({ financialYearId });
    } finally {
      setSwitching(false);
    }
  }

  if (!session?.user) return null;

  return (
    <Select
      value={session.user.financialYearId ?? undefined}
      onValueChange={handleChange}
      disabled={switching}
      items={options.map((fy) => ({ value: fy.id, label: fy.label }))}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Financial year" />
      </SelectTrigger>
      <SelectContent>
        {options.map((fy) => (
          <SelectItem key={fy.id} value={fy.id}>
            {fy.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
