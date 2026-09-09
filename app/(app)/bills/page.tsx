"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { formatTimestamp } from "@/lib/datetime/format";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { printBill, printReceipt } from "@/lib/billing/printing";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface BillRow {
  id: string;
  documentNumber: string;
  billType: string;
  status: string;
  billDate: string;
  grandTotal: string;
  createdAt: string;
  customer: { name: string; phone: string } | null;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

type PrintAction = { id: string; kind: "receipt" | "bill" } | null;

export default function BillsPage() {
  const currencySymbol = useStoreCurrencySymbol();
  const [printing, setPrinting] = useState<PrintAction>(null);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function handlePrintReceipt(row: BillRow, e: React.MouseEvent) {
    e.stopPropagation();
    setPrinting({ id: row.id, kind: "receipt" });
    try {
      const res = await fetch(`/api/bills/${row.id}`);
      if (res.ok) {
        await printReceipt(await res.json());
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the receipt.");
    } finally {
      setPrinting(null);
    }
  }

  async function handlePrintBill(row: BillRow, e: React.MouseEvent) {
    e.stopPropagation();
    setPrinting({ id: row.id, kind: "bill" });
    try {
      await printBill(row.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the bill.");
    } finally {
      setPrinting(null);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills</h1>
        <div className="flex gap-2">
          <Link
            href="/billing/drafts"
            data-kbd-item=""
            className={buttonVariants({ variant: "outline" })}
          >
            Draft bills
          </Link>
          <Link
            href="/billing/held"
            data-kbd-item=""
            className={buttonVariants({ variant: "outline" })}
          >
            Held bills
          </Link>
          <Link href="/billing" data-kbd-item="" className={buttonVariants()}>
            New Bill
          </Link>
        </div>
      </div>

      <DataTable<BillRow>
        resource="bills"
        getRowId={(row) => row.id}
        rowHref={(row) => `/bills/${row.id}`}
        filters={{ status: "completed" }}
        searchable
        columns={[
          { key: "documentNumber", header: "Bill No." },
          { key: "billType", header: "Type", render: (row) => BILL_TYPE_LABELS[row.billType] },
          { key: "status", header: "Status" },
          {
            key: "billDate",
            header: "Bill date",
            render: (row) => formatDateOnly(toDateOnly(row.billDate)),
          },
          {
            key: "customer",
            header: "Customer",
            render: (row) => (row.customer ? row.customer.name : "Walk-in"),
          },
          {
            key: "grandTotal",
            header: "Grand total",
            render: (row) => `${currencySymbol}${Number(row.grandTotal).toFixed(2)}`,
          },
          {
            key: "createdAt",
            header: "Created",
            render: (row) => formatTimestamp(row.createdAt),
          },
          {
            key: "print",
            header: "",
            render: (row) => (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  data-kbd-item=""
                  disabled={printing?.id === row.id}
                  onClick={(e) => handlePrintReceipt(row, e)}
                >
                  {printing?.id === row.id && printing.kind === "receipt" ? "Printing…" : "Receipt"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-kbd-item=""
                  disabled={printing?.id === row.id}
                  onClick={(e) => handlePrintBill(row, e)}
                >
                  {printing?.id === row.id && printing.kind === "bill" ? "Printing…" : "Bill"}
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
