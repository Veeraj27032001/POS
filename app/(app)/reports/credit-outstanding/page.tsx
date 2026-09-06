"use client";

import { useEffect, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface CreditOutstandingRow {
  billId: string;
  documentNumber: string;
  billDate: string;
  dueDate: string | null;
  customerName: string;
  customerPhone: string;
  grandTotal: number;
  outstanding: number;
  daysOverdue: number;
  bucket: string;
}

const BUCKETS = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"];

export default function CreditOutstandingReportPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const currencySymbol = useStoreCurrencySymbol();
  const customers = useOptionsList("customers", "name");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!selectedStoreId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams({
      storeId: selectedStoreId,
      ...(customerId ? { customerId } : {}),
      pageSize: "1",
    }).toString();
    fetch(`/api/reports/credit-outstanding?${qs}`)
      .then((res) => res.json())
      .then((data: { summary: Record<string, number> }) => {
        if (!cancelled) setSummary(data.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, customerId]);

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Credit Bill Outstanding / Aging</h1>
        <p className="text-muted-foreground text-sm">
          Who owes what on completed credit bills, aged by due date.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <>
          <div className="w-56 space-y-1.5">
            <SearchableSelect
              options={customers}
              value={customerId}
              onChange={setCustomerId}
              placeholder="All customers"
            />
          </div>

          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {BUCKETS.map((bucket) => (
                <div key={bucket} className="bg-card rounded-lg border p-3 text-sm">
                  <div className="text-muted-foreground text-xs">{bucket}</div>
                  <div className="text-lg font-semibold">
                    {currencySymbol}
                    {(summary[bucket] ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DataTable<CreditOutstandingRow>
            resource="reports/credit-outstanding"
            getRowId={(row) => row.billId}
            searchable
            rowHref={(row) => `/bills/${row.billId}`}
            filters={{ storeId: selectedStoreId, customerId: customerId ?? undefined }}
            emptyMessage="No outstanding credit bills match these filters."
            columns={[
              { key: "documentNumber", header: "Bill No." },
              {
                key: "billDate",
                header: "Bill Date",
                render: (row) => new Date(row.billDate).toLocaleDateString("en-IN"),
              },
              {
                key: "dueDate",
                header: "Due Date",
                render: (row) =>
                  row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-IN") : "—",
              },
              { key: "customerName", header: "Customer" },
              { key: "customerPhone", header: "Phone" },
              {
                key: "grandTotal",
                header: "Bill Total",
                render: (row) => `${currencySymbol}${row.grandTotal.toFixed(2)}`,
              },
              {
                key: "outstanding",
                header: "Outstanding",
                render: (row) => `${currencySymbol}${row.outstanding.toFixed(2)}`,
              },
              { key: "bucket", header: "Aging" },
            ]}
          />
        </>
      )}
    </div>
  );
}
