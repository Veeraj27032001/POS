"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/searchable-select";
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
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface ReturnDetail {
  id: string;
  documentNumber: string;
  createdAt: string;
  billId: string;
  bill: { documentNumber: string; customer: { name: string; phone: string } | null };
  reasonCode: { label: string };
  processedByUser: { name: string };
  lines: {
    id: string;
    quantity: number;
    condition: string;
    warehouse: { name: string };
    billLine: { productName: string; productBarcode: string };
  }[];
  creditNotes: { id: string; documentNumber: string; amount: string }[];
  refunds: {
    id: string;
    documentNumber: string;
    amount: string;
    status: string;
    refundMethod: { name: string } | null;
  }[];
  value: { amount: number };
  refundableAmount: number;
  settled: boolean;
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

function RefundDialog({
  returnId,
  maxAmount,
  onSettled,
}: {
  returnId: string;
  maxAmount: number;
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [refundMethodId, setRefundMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => money(maxAmount));
  const [submitting, setSubmitting] = useState(false);
  const paymentMethods = useOptionsList("payment-methods/options", "name");

  async function submit() {
    if (!refundMethodId) {
      toast.error("Select a refund method.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bill-returns/${returnId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundMethodId, amount: Number(amount) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to process the refund.");
        return;
      }
      toast.success("Refund recorded.");
      setOpen(false);
      onSettled();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Refund</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Refund method</Label>
          <SearchableSelect
            options={paymentMethods}
            value={refundMethodId}
            onChange={setRefundMethodId}
            placeholder="Select method…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input
            type="number"
            min={0}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">Up to {money(maxAmount)}.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Processing…" : "Process refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BillReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ReturnDetail | null | undefined>(undefined);
  const [issuingCreditNote, setIssuingCreditNote] = useState(false);
  const currencySymbol = useStoreCurrencySymbol();

  function load() {
    fetch(`/api/bill-returns/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setDetail(body));
  }

  useEffect(load, [id]);

  async function handleCreditNote() {
    setIssuingCreditNote(true);
    try {
      const res = await fetch(`/api/bill-returns/${id}/credit-note`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to issue the credit note.");
        return;
      }
      toast.success("Credit note issued.");
      load();
    } finally {
      setIssuingCreditNote(false);
    }
  }

  return (
    <div className="space-y-4 p-8">
      {detail === undefined && <p className="text-muted-foreground">Loading…</p>}
      {detail === null && <p className="text-muted-foreground">Return not found.</p>}

      {detail && (
        <>
          <Link
            href={`/bills/${detail.billId}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Back to bill {detail.bill.documentNumber}
          </Link>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{detail.documentNumber}</h1>
            {!detail.settled && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!detail.bill.customer || issuingCreditNote}
                  onClick={handleCreditNote}
                >
                  {issuingCreditNote ? "Issuing…" : "Issue Credit Note"}
                </Button>
                <RefundDialog
                  returnId={detail.id}
                  maxAmount={Math.min(detail.value.amount, detail.refundableAmount)}
                  onSettled={load}
                />
              </div>
            )}
          </div>
          {!detail.settled && !detail.bill.customer && (
            <p className="text-muted-foreground text-sm">
              This bill has no customer, so a Credit Note is not available — use Refund instead.
            </p>
          )}

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Reason", detail.reasonCode.label],
              ["Processed by", detail.processedByUser.name],
              ["Created", formatTimestamp(detail.createdAt)],
              ["Value", `${currencySymbol}${money(detail.value.amount)}`],
              [
                "Customer",
                detail.bill.customer
                  ? `${detail.bill.customer.name} — ${detail.bill.customer.phone}`
                  : "Walk-in",
              ],
            ].map(([label, value]) => (
              <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Warehouse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div>{line.billLine.productName}</div>
                      <div className="text-muted-foreground text-xs">
                        {line.billLine.productBarcode}
                      </div>
                    </TableCell>
                    <TableCell>{line.quantity}</TableCell>
                    <TableCell className="capitalize">{line.condition}</TableCell>
                    <TableCell>{line.warehouse.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {detail.creditNotes.length > 0 && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="text-muted-foreground text-xs font-medium">Credit Note</div>
              <div>
                {detail.creditNotes[0].documentNumber} — {currencySymbol}
                {money(detail.creditNotes[0].amount)}
              </div>
            </div>
          )}

          {detail.refunds.length > 0 && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="text-muted-foreground text-xs font-medium">Refund</div>
              <div>
                {detail.refunds[0].documentNumber} — {currencySymbol}
                {money(detail.refunds[0].amount)} via {detail.refunds[0].refundMethod?.name} (
                {detail.refunds[0].status})
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
