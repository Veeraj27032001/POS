"use client";

import { DataTable } from "@/components/data-table/data-table";
import { formatTimestamp } from "@/lib/datetime/format";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface BillReturnRow {
  id: string;
  documentNumber: string;
  createdAt: string;
  settled: boolean;
  bill: { documentNumber: string; billType: string };
  reasonCode: { label: string };
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

export default function BillReturnsPage() {
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Returns</h1>

      <DataTable<BillReturnRow>
        resource="bill-returns"
        getRowId={(row) => row.id}
        rowHref={(row) => `/bill-returns/${row.id}`}
        columns={[
          { key: "documentNumber", header: "Return No." },
          {
            key: "bill",
            header: "Bill",
            render: (row) => `${row.bill.documentNumber} (${BILL_TYPE_LABELS[row.bill.billType]})`,
          },
          { key: "reasonCode", header: "Reason", render: (row) => row.reasonCode.label },
          {
            key: "settled",
            header: "Status",
            render: (row) => (row.settled ? "Settled" : "Awaiting settlement"),
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
