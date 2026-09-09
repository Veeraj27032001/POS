"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asAppSession } from "@/lib/auth/types";
import { useSelectedTerminal } from "@/lib/billing/useSelectedTerminal";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface FinancialYearOption {
  id: string;
  label: string;
}

export default function SelectFinancialYearPage() {
  return (
    <Suspense fallback={null}>
      <SelectFinancialYearForm />
    </Suspense>
  );
}

function SelectFinancialYearForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, update } = useSession();
  const session = asAppSession(data ?? null);

  const [options, setOptions] = useState<FinancialYearOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const terminals = useOptionsList("terminals", "name");
  const { terminalId, setTerminalId } = useSelectedTerminal();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-kbd-item]" });

  useEffect(() => {
    fetch("/api/financial-years")
      .then((res) => res.json())
      .then((json: { financialYears: FinancialYearOption[] }) => {
        setOptions(json.financialYears);
        if (json.financialYears.length > 0) setSelected(json.financialYears[0].id);
      })
      .catch(() => setOptions([]));
  }, []);

  useEffect(() => {
    if (session?.user && session.user.financialYearId) {
      router.replace(searchParams.get("callbackUrl") ?? "/");
    }
  }, [session, router, searchParams]);

  async function handleContinue() {
    if (!selected) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/financial-year/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financialYearId: selected }),
      });
      if (!res.ok) {
        setFormError("That financial year is not available. Please pick another.");
        return;
      }
      await update({ financialYearId: selected });
      router.push(searchParams.get("callbackUrl") ?? "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="POS logo" width={36} height={36} className="mb-7 rounded-lg" />
      <h1 className="mb-1.5 text-[26px] font-extrabold">Select financial year</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Choose the financial year for this session. You can switch it later from the header.
      </p>

      <div ref={kbdRef} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Financial year</Label>
          <Select
            value={selected}
            onValueChange={(v) => setSelected(v ?? "")}
            items={options.map((fy) => ({ value: fy.id, label: fy.label }))}
          >
            <SelectTrigger data-kbd-item="" className="w-full">
              <SelectValue placeholder="Select financial year…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>
                  {fy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {session?.user.storeId && terminals.length > 0 && (
          <div className="space-y-1.5">
            <Label>
              Terminal
              <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
            </Label>
            <Select
              value={terminalId ?? ""}
              onValueChange={(v) => setTerminalId(v || null)}
              items={terminals}
            >
              <SelectTrigger data-kbd-item="" className="w-full">
                <SelectValue placeholder="Select terminal…" />
              </SelectTrigger>
              <SelectContent>
                {terminals.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Remembered on this device — Billing will use it automatically.
            </p>
          </div>
        )}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <Button
          data-kbd-item=""
          className="w-full"
          disabled={!selected || submitting}
          onClick={handleContinue}
        >
          {submitting ? "Continuing…" : "Continue"}
        </Button>
      </div>
    </AuthSplitLayout>
  );
}
