"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatTimestamp } from "@/lib/datetime/format";

interface BillRow {
  id: string;
  documentNumber: string;
  billType: string;
  status: string;
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
            key: "customer",
            header: "Customer",
            render: (row) => (row.customer ? row.customer.name : "Walk-in"),
          },
          {
            key: "grandTotal",
            header: "Grand total",
            render: (row) => `₹${Number(row.grandTotal).toFixed(2)}`,
          },
          {
            key: "createdAt",
            header: "Created",
            render: (row) => formatTimestamp(row.createdAt),
          },
        ]}
      />
    </div>
  );
}
