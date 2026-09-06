"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { formatTimestamp } from "@/lib/datetime/format";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";

interface OnlineOrderRow {
  id: string;
  documentNumber: string;
  status: "pending" | "accepted" | "rejected";
  customerName: string;
  customerPhone: string;
  itemCount: number;
  grandTotal: string | null;
  billDocumentNumber: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<OnlineOrderRow["status"], "default" | "secondary" | "destructive"> = {
  pending: "default",
  accepted: "secondary",
  rejected: "destructive",
};

// A pending row here is a real order awaiting Accept/Reject — nothing has
// been billed yet, so there's no invoice to undo if it's rejected. Once
// accepted it links to the real Bill that got created at that moment.
export default function OnlineOrdersPage() {
  const currencySymbol = useStoreCurrencySymbol();

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Online Orders</h1>
        <p className="text-muted-foreground text-sm">
          Orders placed through the e-commerce API, awaiting your decision. Open one to Accept
          (creates the real bill and deducts stock) or Reject (releases the reserved stock, no
          invoice created).
        </p>
      </div>

      <DataTable<OnlineOrderRow>
        resource="online-orders"
        getRowId={(row) => row.id}
        rowHref={(row) => `/online-orders/${row.id}`}
        searchable
        columns={[
          { key: "documentNumber", header: "Order No." },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge variant={STATUS_BADGE[row.status]}>{row.status}</Badge>,
          },
          { key: "customerName", header: "Customer" },
          { key: "customerPhone", header: "Phone" },
          { key: "itemCount", header: "Items" },
          {
            key: "grandTotal",
            header: "Total",
            render: (row) =>
              row.grandTotal ? `${currencySymbol}${Number(row.grandTotal).toFixed(2)}` : "—",
          },
          {
            key: "billDocumentNumber",
            header: "Bill No.",
            render: (row) => row.billDocumentNumber ?? "—",
          },
          {
            key: "createdAt",
            header: "Placed",
            render: (row) => formatTimestamp(row.createdAt),
          },
        ]}
      />
    </div>
  );
}
