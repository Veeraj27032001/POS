"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { printCreditNote } from "@/lib/billing/printing";

interface CreditNoteRow {
  id: string;
  documentNumber: string;
  amount: string;
  createdAt: string;
  originalBill: { documentNumber: string; billType: string };
  customer: { name: string; phone: string };
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

export default function CreditNotesPage() {
  const currencySymbol = useStoreCurrencySymbol();
  const [printingId, setPrintingId] = useState<string | null>(null);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function handlePrint(row: CreditNoteRow, e: React.MouseEvent) {
    e.stopPropagation();
    setPrintingId(row.id);
    try {
      await printCreditNote(row.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the credit note.");
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Credit Notes</h1>

      <DataTable<CreditNoteRow>
        resource="credit-notes"
        getRowId={(row) => row.id}
        rowHref={(row) => `/credit-notes/${row.id}`}
        columns={[
          { key: "documentNumber", header: "Credit Note No." },
          {
            key: "originalBill",
            header: "Bill",
            render: (row) =>
              `${row.originalBill.documentNumber} (${BILL_TYPE_LABELS[row.originalBill.billType]})`,
          },
          { key: "customer", header: "Customer", render: (row) => row.customer.name },
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
                data-kbd-item=""
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
