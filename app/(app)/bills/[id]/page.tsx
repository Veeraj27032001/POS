"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatTimestamp } from "@/lib/datetime/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BillLineRow {
  id: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  unitPrice: string;
  discountApplied: string | null;
  lineTotal: string;
  status: string;
}

interface BillPaymentRow {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  paymentMethod: { name: string };
}

interface BillDetail {
  id: string;
  documentNumber: string;
  billType: string;
  status: string;
  customer: { name: string; phone: string } | null;
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
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

export default function BillViewPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<BillDetail | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/bills/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setBill(body));
  }, [id]);

  return (
    <div className="space-y-4 p-8">
      <Link href="/bills" className="text-muted-foreground text-sm hover:underline">
        ← Back to Bills
      </Link>

      {bill === undefined && <p className="text-muted-foreground">Loading…</p>}
      {bill === null && <p className="text-muted-foreground">Bill not found.</p>}

      {bill && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{bill.documentNumber}</h1>
            <span className="text-muted-foreground text-sm capitalize">{bill.status}</span>
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Type", BILL_TYPE_LABELS[bill.billType]],
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div>{line.productName}</div>
                      <div className="text-muted-foreground text-xs">{line.productBarcode}</div>
                    </TableCell>
                    <TableCell>{line.quantity}</TableCell>
                    <TableCell>₹{money(line.unitPrice)}</TableCell>
                    <TableCell>
                      {line.discountApplied ? `₹${money(line.discountApplied)}` : "—"}
                    </TableCell>
                    <TableCell>₹{money(line.lineTotal)}</TableCell>
                    <TableCell className="capitalize">{line.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border">
              {[
                ["Subtotal", `₹${money(bill.subtotal)}`],
                ["Discount", `₹${money(bill.discountTotal)}`],
                ["Tax", `₹${money(bill.taxTotal)}`],
                ["Grand total", `₹${money(bill.grandTotal)}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-card flex justify-between p-3 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </dl>

            <div className="rounded-lg border">
              <div className="text-muted-foreground bg-muted/40 border-b p-3 text-xs font-medium">
                Payments
              </div>
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
                      <div>₹{money(p.amount)}</div>
                      <div className="text-muted-foreground text-xs capitalize">{p.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
