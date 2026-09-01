"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { formatTimestamp } from "@/lib/datetime/format";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { printBillReceipt } from "@/lib/billing/printBillReceipt";

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

export default function BillsPage() {
  const currencySymbol = useStoreCurrencySymbol();
  const [printingId, setPrintingId] = useState<string | null>(null);

  async function handlePrint(row: BillRow, e: React.MouseEvent) {
    e.stopPropagation();
    setPrintingId(row.id);
    try {
      const res = await fetch(`/api/bills/${row.id}`);
      if (res.ok) {
        await printBillReceipt(await res.json());
      }
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bills</h1>
        <Link href="/billing" className={buttonVariants()}>
          New Bill
        </Link>
      </div>

      <DataTable<BillRow>
        resource="bills"
        getRowId={(row) => row.id}
        rowHref={(row) => `/bills/${row.id}`}
        filters={{ status: "completed" }}
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
              <Button
                variant="outline"
                size="sm"
                disabled={printingId === row.id}
                onClick={(e) => handlePrint(row, e)}
              >
                {printingId === row.id ? "Printing…" : "Print"}
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
