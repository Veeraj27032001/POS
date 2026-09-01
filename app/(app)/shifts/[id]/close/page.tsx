"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";

interface ShiftInfo {
  id: string;
  documentNumber: string;
  storeId: string;
  status: string;
  computedClosingExpected: { closingExpected: number } | null;
}

interface Denomination {
  id: string;
  value: string;
  type: string;
}

function money(value: number): string {
  return value.toFixed(2);
}

export default function CloseShiftPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [shift, setShift] = useState<ShiftInfo | null | undefined>(undefined);
  const [denominations, setDenominations] = useState<Denomination[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [closingCounted, setClosingCounted] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const currencySymbol = useStoreCurrencySymbol();

  useEffect(() => {
    fetch(`/api/shifts/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ShiftInfo | null) => setShift(body));
  }, [id]);

  useEffect(() => {
    if (!shift) return;
    fetch(`/api/cash-denominations?storeId=${shift.storeId}&pageSize=200`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: Denomination[] } | null) => {
        if (body) setDenominations(body.data);
      });
  }, [shift]);

  const breakdownSum = denominations.reduce((sum, d) => {
    const qty = Number(counts[d.id]) || 0;
    return sum + Number(d.value) * qty;
  }, 0);

  async function handleSubmit() {
    if (!shift) return;
    const amount = Number(closingCounted);
    if (!closingCounted || Number.isNaN(amount) || amount < 0) {
      toast.error("Enter the counted cash amount.");
      return;
    }
    const closingCounts = denominations
      .map((d) => {
        const qty = Number(counts[d.id]) || 0;
        return qty > 0 ? { denominationId: d.id, quantityCounted: qty } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shifts/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCounted: amount,
          closingCounts: closingCounts.length > 0 ? closingCounts : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to close the shift.");
        return;
      }
      const body = (await res.json()) as { breakdownWarning?: string };
      if (body.breakdownWarning) toast.warning(body.breakdownWarning);
      toast.success("Shift closed.");
      router.push(`/shifts/${id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4 p-8">
      <Link href={`/shifts/${id}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to shift
      </Link>

      {shift === undefined && <p className="text-muted-foreground">Loading…</p>}
      {shift === null && <p className="text-muted-foreground">Shift not found.</p>}

      {shift && shift.status !== "open" && (
        <p className="text-muted-foreground">This shift is already closed.</p>
      )}

      {shift && shift.status === "open" && (
        <>
          <h1 className="text-2xl font-semibold">Close Shift — {shift.documentNumber}</h1>

          {shift.computedClosingExpected && (
            <p className="text-muted-foreground text-sm">
              Expected cash: {currencySymbol}
              {money(shift.computedClosingExpected.closingExpected)}
            </p>
          )}

          <div className="max-w-xs space-y-1.5">
            <Label>Counted cash</Label>
            <Input
              type="number"
              min={0}
              value={closingCounted}
              onChange={(e) => setClosingCounted(e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBreakdown((v) => !v)}
          >
            {showBreakdown ? "Hide" : "Add"} denomination breakdown
          </Button>

          {showBreakdown && denominations.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Denomination</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denominations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {currencySymbol}
                        {money(Number(d.value))}
                      </TableCell>
                      <TableCell className="capitalize">{d.type}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={counts[d.id] ?? ""}
                          onChange={(e) =>
                            setCounts((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          className="w-20"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-muted-foreground border-t p-3 text-sm">
                Breakdown total: {currencySymbol}
                {money(breakdownSum)}
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Closing…" : "Close Shift"}
          </Button>
        </>
      )}
    </div>
  );
}
