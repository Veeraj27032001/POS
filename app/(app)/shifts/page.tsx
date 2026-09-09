"use client";

import { useState } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/searchable-select";
import { DataTable } from "@/components/data-table/data-table";
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
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

interface ShiftRow {
  id: string;
  documentNumber: string;
  status: string;
  openedAt: string | null;
  closedAt: string | null;
  variance: string | null;
  terminal: { name: string };
  cashierUser: { name: string };
}

function OpenShiftDialog({ onOpened }: { onOpened: () => void }) {
  const [open, setOpen] = useState(false);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [openingFloat, setOpeningFloat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const terminals = useOptionsList("terminals", "name");

  async function submit() {
    if (!terminalId) {
      toast.error("Select a terminal.");
      return;
    }
    const amount = Number(openingFloat);
    if (!openingFloat || Number.isNaN(amount) || amount < 0) {
      toast.error("Enter the opening float amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalId, openingFloat: amount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to open the shift.");
        return;
      }
      toast.success("Shift opened.");
      setOpen(false);
      setTerminalId(null);
      setOpeningFloat("");
      onOpened();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" data-kbd-item="" />}>Open Shift</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Terminal</Label>
          <SearchableSelect
            options={terminals}
            value={terminalId}
            onChange={setTerminalId}
            placeholder="Select terminal…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Opening float</Label>
          <Input
            type="number"
            min={0}
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Opening…" : "Open Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ShiftsPage() {
  const currencySymbol = useStoreCurrencySymbol();
  const invalidate = useInvalidateResource();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <OpenShiftDialog onOpened={() => invalidate("shifts")} />
      </div>

      <DataTable<ShiftRow>
        resource="shifts"
        getRowId={(row) => row.id}
        rowHref={(row) => `/shifts/${row.id}`}
        columns={[
          { key: "documentNumber", header: "Shift No." },
          { key: "terminal", header: "Terminal", render: (row) => row.terminal.name },
          { key: "cashierUser", header: "Cashier", render: (row) => row.cashierUser.name },
          { key: "status", header: "Status" },
          {
            key: "openedAt",
            header: "Opened",
            render: (row) => (row.openedAt ? formatTimestamp(row.openedAt) : "—"),
          },
          {
            key: "closedAt",
            header: "Closed",
            render: (row) => (row.closedAt ? formatTimestamp(row.closedAt) : "—"),
          },
          {
            key: "variance",
            header: "Variance",
            render: (row) =>
              row.variance === null ? "—" : `${currencySymbol}${Number(row.variance).toFixed(2)}`,
          },
        ]}
      />
    </div>
  );
}
