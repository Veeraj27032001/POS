"use client";

import { DataTable } from "@/components/data-table/data-table";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";

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

export default function ShiftsPage() {
  const currencySymbol = useStoreCurrencySymbol();

  return (
    <div className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Shifts</h1>

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
