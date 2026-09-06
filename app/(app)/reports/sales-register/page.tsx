"use client";

import { useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface SalesRegisterRow {
  id: string;
  documentNumber: string;
  billDate: string;
  billType: string;
  customerName: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash",
  credit_bill: "Credit",
  online_bill: "Online",
};

export default function SalesRegisterReportPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const currencySymbol = useStoreCurrencySymbol();
  const customers = useOptionsList("customers", "name");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [billType, setBillType] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Sales Register</h1>
        <p className="text-muted-foreground text-sm">
          Every completed bill for the selected store — the core GST sales record.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 space-y-1.5">
              <SearchableSelect
                options={customers}
                value={customerId}
                onChange={setCustomerId}
                placeholder="All customers"
              />
            </div>
            <div className="w-48 space-y-1.5">
              <SearchableSelect
                options={[
                  { value: "cash_bill", label: "Cash" },
                  { value: "credit_bill", label: "Credit" },
                  { value: "online_bill", label: "Online" },
                ]}
                value={billType}
                onChange={setBillType}
                placeholder="All bill types"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <DataTable<SalesRegisterRow>
            resource="reports/sales-register"
            getRowId={(row) => row.id}
            searchable
            rowHref={(row) => `/bills/${row.id}`}
            filters={{
              storeId: selectedStoreId,
              customerId: customerId ?? undefined,
              billType: billType ?? undefined,
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            }}
            emptyMessage="No completed bills match these filters."
            columns={[
              { key: "documentNumber", header: "Bill No." },
              {
                key: "billDate",
                header: "Date",
                render: (row) => new Date(row.billDate).toLocaleDateString("en-IN"),
              },
              {
                key: "billType",
                header: "Type",
                render: (row) => BILL_TYPE_LABELS[row.billType] ?? row.billType,
              },
              { key: "customerName", header: "Customer" },
              {
                key: "subtotal",
                header: "Subtotal",
                render: (row) => `${currencySymbol}${row.subtotal.toFixed(2)}`,
              },
              {
                key: "discountTotal",
                header: "Discount",
                render: (row) => `${currencySymbol}${row.discountTotal.toFixed(2)}`,
              },
              {
                key: "taxTotal",
                header: "Tax",
                render: (row) => `${currencySymbol}${row.taxTotal.toFixed(2)}`,
              },
              {
                key: "grandTotal",
                header: "Grand Total",
                render: (row) => `${currencySymbol}${row.grandTotal.toFixed(2)}`,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
