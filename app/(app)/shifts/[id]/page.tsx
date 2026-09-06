"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";

interface ShiftCashCountRow {
  id: string;
  countType: string;
  quantityCounted: number;
  denomination: { value: string; type: string };
}

interface ShiftDetail {
  id: string;
  documentNumber: string;
  status: string;
  openingFloat: string;
  closingExpected: string | null;
  closingCounted: string | null;
  variance: string | null;
  openedAt: string | null;
  closedAt: string | null;
  terminal: { name: string };
  cashierUser: { name: string };
  cashCounts: ShiftCashCountRow[];
  computedClosingExpected: {
    openingFloat: number;
    cashSales: number;
    cashRefunds: number;
    closingExpected: number;
  } | null;
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [shift, setShift] = useState<ShiftDetail | null | undefined>(undefined);
  const currencySymbol = useStoreCurrencySymbol();

  useEffect(() => {
    fetch(`/api/shifts/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setShift(body));
  }, [id]);

  const openingCounts = shift?.cashCounts.filter((c) => c.countType === "opening") ?? [];
  const closingCounts = shift?.cashCounts.filter((c) => c.countType === "closing") ?? [];

  return (
    <div className="space-y-4 p-8">
      <Link href="/shifts" className="text-muted-foreground text-sm hover:underline">
        ← Back to Shifts
      </Link>

      {shift === undefined && <p className="text-muted-foreground">Loading…</p>}
      {shift === null && <p className="text-muted-foreground">Shift not found.</p>}

      {shift && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">{shift.documentNumber}</h1>
            {shift.status === "open" && (
              <Link href={`/shifts/${shift.id}/close`} className={buttonVariants({ size: "sm" })}>
                Close Shift
              </Link>
            )}
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Terminal", shift.terminal.name],
              ["Cashier", shift.cashierUser.name],
              ["Status", shift.status],
              ["Opened", shift.openedAt ? formatTimestamp(shift.openedAt) : "—"],
              ["Closed", shift.closedAt ? formatTimestamp(shift.closedAt) : "—"],
              ["Opening float", `${currencySymbol}${money(shift.openingFloat)}`],
              [
                "Closing expected",
                shift.closingExpected !== null
                  ? `${currencySymbol}${money(shift.closingExpected)}`
                  : shift.computedClosingExpected
                    ? `${currencySymbol}${money(shift.computedClosingExpected.closingExpected)} (so far)`
                    : "—",
              ],
              [
                "Closing counted",
                shift.closingCounted !== null
                  ? `${currencySymbol}${money(shift.closingCounted)}`
                  : "—",
              ],
              [
                "Variance",
                shift.variance !== null ? `${currencySymbol}${money(shift.variance)}` : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>

          {[
            { title: "Opening cash count", rows: openingCounts },
            { title: "Closing cash count", rows: closingCounts },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.title} className="rounded-lg border">
                <div className="text-muted-foreground bg-muted/40 border-b p-3 text-xs font-medium">
                  {group.title}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Denomination</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {currencySymbol}
                          {money(c.denomination.value)}
                        </TableCell>
                        <TableCell className="capitalize">{c.denomination.type}</TableCell>
                        <TableCell>{c.quantityCounted}</TableCell>
                        <TableCell>
                          {currencySymbol}
                          {money(Number(c.denomination.value) * c.quantityCounted)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
