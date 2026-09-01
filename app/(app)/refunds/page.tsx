"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";
import { printRefund } from "@/lib/billing/printing";

interface RefundRow {
  id: string;
  documentNumber: string;
  amount: string;
  status: string;
  createdAt: string;
  sourceDocumentNumber: string | null;
  billDocumentNumber: string | null;
  refundMethod: { name: string } | null;
}

export default function RefundsPage() {
  const currencySymbol = useStoreCurrencySymbol();
  const [printingId, setPrintingId] = useState<string | null>(null);

  async function handlePrint(row: RefundRow, e: React.MouseEvent) {
    e.stopPropagation();
    setPrintingId(row.id);
    try {
      await printRefund(row.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the refund.");
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Refunds</h1>

      <DataTable<RefundRow>
        resource="refunds"
        getRowId={(row) => row.id}
        rowHref={(row) => `/refunds/${row.id}`}
        columns={[
          { key: "documentNumber", header: "Refund No." },
          {
            key: "billDocumentNumber",
            header: "Bill",
            render: (row) => row.billDocumentNumber ?? "—",
          },
          {
            key: "sourceDocumentNumber",
            header: "Source",
            render: (row) => row.sourceDocumentNumber ?? "—",
          },
          {
            key: "refundMethod",
            header: "Method",
            render: (row) => row.refundMethod?.name ?? "—",
          },
          { key: "status", header: "Status", render: (row) => row.status },
          {
            key: "amount",
            header: "Amount",
            render: (row) => `${currencySymbol}${Number(row.amount).toFixed(2)}`,
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
