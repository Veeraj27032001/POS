"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { toast } from "sonner";

import { SendPaymentLinkDialog } from "@/components/billing/send-payment-link-dialog";
import { EditableLineValue } from "@/components/billing/editable-line-value";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { useStorePaymentGatewayAvailable } from "@/lib/hooks/useStorePaymentGatewayAvailable";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { formatTimestamp } from "@/lib/datetime/format";
import { printBill, printReceipt } from "@/lib/billing/printing";
import {
  EDITABLE_COMPLETED_BILL_WINDOW_HOURS,
  isCompletedBillStillEditable,
} from "@/lib/billing/editableCompletedBillWindow";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { SearchableSelect } from "@/components/searchable-select";
import { Button, buttonVariants } from "@/components/ui/button";
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

interface BillLineAllocationRow {
  id: string;
  quantity: number;
  warehouse: { id: string; name: string; store: { id: string; name: string } | null };
}

interface BillLineRow {
  id: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  unitPrice: string;
  discountApplied: string | null;
  lineTotal: string;
  status: string;
  allocations: BillLineAllocationRow[];
}

interface BillPaymentRow {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  paymentMethod: { name: string };
}

interface BillReturnRow {
  id: string;
  documentNumber: string;
  createdAt: string;
  reasonCode: { label: string };
  settled: boolean;
}

interface BillDetail {
  id: string;
  documentNumber: string;
  billType: string;
  status: string;
  billDate: string;
  storeId: string;
  customer: { name: string; phone: string; email: string | null } | null;
  terminal: { name: string };
  cashierUser: { name: string };
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  createdAt: string;
  completedAt: string | null;
  lines: BillLineRow[];
  payments: BillPaymentRow[];
  returns: BillReturnRow[];
  outstandingBalance: number;
  gatewayCollectionRequested: boolean;
  receiptSnapshot: {
    storeName: string;
    headerText: string | null;
    footerText: string | null;
    returnPolicyText: string | null;
  } | null;
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

// Every line always names the warehouse it actually drew stock from. Most
// bills only ever touch their own store's warehouses, so this stays quiet
// (just the warehouse name) — it only calls out the store by name, in an
// amber badge, for an allocation sourced from somewhere else. That's the
// only on-bill trace of a cross-store online-order line, since no transfer
// document is ever created for it.
function LineSource({ bill, line }: { bill: BillDetail; line: BillLineRow }) {
  if (line.allocations.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {line.allocations.map((a) => {
        const foreign = a.warehouse.store && a.warehouse.store.id !== bill.storeId;
        return (
          <span
            key={a.id}
            className={
              foreign
                ? "bg-warning/15 text-warning rounded px-1.5 py-0.5 text-xs"
                : "text-muted-foreground text-xs"
            }
            title={`${a.quantity} unit(s)`}
          >
            {foreign ? `${a.warehouse.store!.name} — ${a.warehouse.name}` : a.warehouse.name}
          </span>
        );
      })}
    </div>
  );
}

function RecordPaymentDialog({
  billId,
  maxAmount,
  onRecorded,
}: {
  billId: string;
  maxAmount: number;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => money(maxAmount));
  const [submitting, setSubmitting] = useState(false);
  const paymentMethods = useOptionsList("payment-methods/options", "name");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-kbd-item]" });

  async function submit() {
    if (!paymentMethodId) {
      toast.error("Select a payment method.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bills/${billId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId, amount: Number(amount) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to record payment.");
        return;
      }
      toast.success("Payment recorded.");
      setOpen(false);
      onRecorded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" data-kbd-item="" />}>Record payment</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div ref={kbdRef} className="contents">
          <div className="space-y-1.5">
            <Label>Method</Label>
            <SearchableSelect
              data-kbd-item=""
              options={paymentMethods}
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              placeholder="Select method…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              type="number"
              min={0}
              max={maxAmount}
              data-kbd-item=""
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">Up to {money(maxAmount)}.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" data-kbd-item="" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              data-kbd-item=""
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BillViewPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<BillDetail | null | undefined>(undefined);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null);
  const currencySymbol = useStoreCurrencySymbol();
  const paymentGatewayAvailable = useStorePaymentGatewayAvailable();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function handlePrintReceipt() {
    if (!bill) return;
    setPrintingReceipt(true);
    try {
      await printReceipt(bill);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the receipt.");
    } finally {
      setPrintingReceipt(false);
    }
  }

  async function handlePrintBill() {
    if (!bill) return;
    setPrintingBill(true);
    try {
      await printBill(bill.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the bill.");
    } finally {
      setPrintingBill(false);
    }
  }

  function load() {
    fetch(`/api/bills/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setBill(body));
  }

  useEffect(load, [id]);

  const canEditCompletedLines =
    bill != null && bill.status === "completed" && isCompletedBillStillEditable(bill.completedAt);

  async function updateLineQuantity(lineId: string, quantity: number) {
    setUpdatingLineId(lineId);
    try {
      const res = await fetch(`/api/bills/${id}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update the line.");
        return;
      }
      const body = (await res.json()) as { warning?: string };
      if (body.warning) toast.warning(body.warning);
      toast.success("Line updated.");
      load();
    } finally {
      setUpdatingLineId(null);
    }
  }

  async function removeLine(lineId: string) {
    if (!window.confirm("Remove this line from the bill? This cannot be undone.")) return;
    setUpdatingLineId(lineId);
    try {
      const res = await fetch(`/api/bills/${id}/lines/${lineId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to remove the line.");
        return;
      }
      toast.success("Line removed.");
      load();
    } finally {
      setUpdatingLineId(null);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/bills"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Bills
      </Link>

      {bill === undefined && <p className="text-muted-foreground">Loading…</p>}
      {bill === null && <p className="text-muted-foreground">Bill not found.</p>}

      {bill && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">{bill.documentNumber}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-sm capitalize">{bill.status}</span>
              <Button
                variant="outline"
                size="sm"
                data-kbd-item=""
                onClick={handlePrintReceipt}
                disabled={printingReceipt}
              >
                {printingReceipt ? "Printing…" : "Print Receipt"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-kbd-item=""
                onClick={handlePrintBill}
                disabled={printingBill}
              >
                {printingBill ? "Printing…" : "Print Bill"}
              </Button>
              {bill.status === "completed" && (
                <Link
                  href={`/bills/${bill.id}/return`}
                  data-kbd-item=""
                  className={buttonVariants({ size: "sm" })}
                >
                  Return
                </Link>
              )}
            </div>
          </div>

          {canEditCompletedLines && (
            <p className="text-warning text-sm">
              This bill can still be edited directly — that window closes{" "}
              {EDITABLE_COMPLETED_BILL_WINDOW_HOURS} hours after completion. After that, use Return
              instead.
            </p>
          )}

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Type", BILL_TYPE_LABELS[bill.billType]],
              ["Bill date", formatDateOnly(toDateOnly(bill.billDate))],
              [
                "Customer",
                bill.customer ? `${bill.customer.name} — ${bill.customer.phone}` : "Walk-in",
              ],
              ["Terminal", bill.terminal.name],
              ["Cashier", bill.cashierUser.name],
              ["Created", formatTimestamp(bill.createdAt)],
              ["Completed", bill.completedAt ? formatTimestamp(bill.completedAt) : "—"],
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
                  <TableHead>Unit price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  {canEditCompletedLines && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.lines.map((line) => {
                  const editable = canEditCompletedLines && line.status === "active";
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>{line.productName}</div>
                        <div className="text-muted-foreground text-xs">{line.productBarcode}</div>
                      </TableCell>
                      <TableCell>
                        {editable ? (
                          <EditableLineValue
                            value={line.quantity}
                            min={1}
                            onCommit={(next) => void updateLineQuantity(line.id, next)}
                          />
                        ) : (
                          line.quantity
                        )}
                      </TableCell>
                      <TableCell>
                        {currencySymbol}
                        {money(line.unitPrice)}
                      </TableCell>
                      <TableCell>
                        {line.discountApplied
                          ? `${currencySymbol}${money(line.discountApplied)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {currencySymbol}
                        {money(line.lineTotal)}
                      </TableCell>
                      <TableCell>
                        <LineSource bill={bill} line={line} />
                      </TableCell>
                      <TableCell className="capitalize">{line.status}</TableCell>
                      {canEditCompletedLines && (
                        <TableCell>
                          {editable && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              data-kbd-item=""
                              disabled={updatingLineId === line.id}
                              onClick={() => void removeLine(line.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border">
              {[
                ["Subtotal", `${currencySymbol}${money(bill.subtotal)}`],
                ["Discount", `${currencySymbol}${money(bill.discountTotal)}`],
                ["Tax", `${currencySymbol}${money(bill.taxTotal)}`],
                ["Grand total", `${currencySymbol}${money(bill.grandTotal)}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-card flex justify-between p-3 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </dl>

            <div className="rounded-lg border">
              <div className="bg-muted/40 flex items-center justify-between border-b p-3">
                <span className="text-muted-foreground text-xs font-medium">Payments</span>
                {bill.status === "completed" &&
                  bill.billType === "credit_bill" &&
                  bill.outstandingBalance > 0 && (
                    <div className="flex gap-2">
                      {paymentGatewayAvailable && (
                        <SendPaymentLinkDialog
                          billId={bill.id}
                          maxAmount={bill.outstandingBalance}
                          currencySymbol={currencySymbol}
                          onPaid={load}
                          customerEmail={bill.customer?.email ?? undefined}
                          customerPhone={bill.customer?.phone ?? undefined}
                        />
                      )}
                      <RecordPaymentDialog
                        billId={bill.id}
                        maxAmount={bill.outstandingBalance}
                        onRecorded={load}
                      />
                    </div>
                  )}
                {bill.status === "completed" &&
                  bill.billType !== "credit_bill" &&
                  bill.gatewayCollectionRequested &&
                  bill.outstandingBalance > 0 && (
                    <Link
                      href={`/billing/${bill.id}/collect`}
                      data-kbd-item=""
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Pay
                    </Link>
                  )}
              </div>
              {bill.status === "completed" && bill.outstandingBalance > 0 && (
                <div className="text-muted-foreground border-b px-3 py-2 text-xs">
                  {currencySymbol}
                  {money(bill.outstandingBalance)} still owed
                </div>
              )}
              {bill.payments.length === 0 && (
                <p className="text-muted-foreground p-3 text-sm">No payments recorded.</p>
              )}
              <div className="divide-y">
                {bill.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div>{p.paymentMethod.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatTimestamp(p.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div>
                        {currencySymbol}
                        {money(p.amount)}
                      </div>
                      <div className="text-muted-foreground text-xs capitalize">{p.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {bill.returns.length > 0 && (
            <div className="rounded-lg border">
              <div className="text-muted-foreground bg-muted/40 border-b p-3 text-xs font-medium">
                Returns
              </div>
              <div className="divide-y">
                {bill.returns.map((r) => (
                  <Link
                    key={r.id}
                    href={`/bill-returns/${r.id}`}
                    data-kbd-item=""
                    className="hover:bg-muted/40 flex items-center justify-between p-3 text-sm"
                  >
                    <div>
                      <div>{r.documentNumber}</div>
                      <div className="text-muted-foreground text-xs">
                        {r.reasonCode.label} · {formatTimestamp(r.createdAt)}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {r.settled ? "Settled" : "Awaiting settlement"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
