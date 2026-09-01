"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { formatTimestamp } from "@/lib/datetime/format";

interface CurrentShift {
  id: string;
  documentNumber: string;
  openedAt: string;
}

interface Denomination {
  id: string;
  value: string;
  type: string;
}

export function ShiftControl({ terminalId, storeId }: { terminalId: string; storeId: string }) {
  const [shift, setShift] = useState<CurrentShift | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [denominations, setDenominations] = useState<Denomination[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function loadCurrent() {
    fetch(`/api/shifts/current?terminalId=${terminalId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { shift: CurrentShift | null } | null) => setShift(body?.shift ?? null));
  }

  useEffect(loadCurrent, [terminalId]);

  useEffect(() => {
    if (!open || denominations.length > 0) return;
    fetch(`/api/cash-denominations?storeId=${storeId}&pageSize=200`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: Denomination[] } | null) => {
        if (body) setDenominations(body.data);
      });
  }, [open, storeId, denominations.length]);

  async function submitOpen() {
    const amount = Number(openingFloat);
    if (!openingFloat || Number.isNaN(amount) || amount < 0) {
      toast.error("Enter the opening float amount.");
      return;
    }
    const openingCounts = denominations
      .map((d) => {
        const qty = Number(counts[d.id]) || 0;
        return qty > 0 ? { denominationId: d.id, quantityCounted: qty } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    setSubmitting(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terminalId,
          openingFloat: amount,
          openingCounts: openingCounts.length > 0 ? openingCounts : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to open the shift.");
        return;
      }
      toast.success("Shift opened.");
      setOpen(false);
      setOpeningFloat("");
      setCounts({});
      loadCurrent();
    } finally {
      setSubmitting(false);
    }
  }

  if (shift === undefined) return null;

  if (shift) {
    return (
      <>
        <span>·</span>
        <span>Shift open since {formatTimestamp(shift.openedAt)}</span>
        <Link href={`/shifts/${shift.id}/close`} className="hover:text-foreground underline">
          Close Shift
        </Link>
      </>
    );
  }

  return (
    <>
      <span>·</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<button type="button" className="hover:text-foreground underline" />}
        >
          Open Shift
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Opening float</Label>
            <Input
              type="number"
              min={0}
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denomination</TableHead>
                  <TableHead>Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {denominations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{Number(d.value).toFixed(2)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={counts[d.id] ?? ""}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="w-20"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button type="button" onClick={() => void submitOpen()} disabled={submitting}>
              {submitting ? "Opening…" : "Open Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
