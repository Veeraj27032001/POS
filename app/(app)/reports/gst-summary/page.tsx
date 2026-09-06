"use client";

import { useEffect, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { StoreCardFilter } from "@/components/store-card-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";

interface GstSummaryRow {
  hsnCode: string;
  description: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export default function GstSummaryReportPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const currencySymbol = useStoreCurrencySymbol();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [grandTotalTax, setGrandTotalTax] = useState<number | null>(null);

  const filters = {
    storeId: selectedStoreId ?? undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  useEffect(() => {
    if (!selectedStoreId) {
      setGrandTotalTax(null);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams({
      storeId: selectedStoreId,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      pageSize: "1",
    }).toString();
    fetch(`/api/reports/gst-summary?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { grandTotalTax: number } | null) => {
        if (!cancelled) setGrandTotalTax(data?.grandTotalTax ?? null);
      })
      .catch(() => {
        if (!cancelled) setGrandTotalTax(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, dateFrom, dateTo]);

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">GST Summary</h1>
        <p className="text-muted-foreground text-sm">
          Tax collected, broken down by HSN code and tax component — for filing against the
          store&apos;s GSTIN.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {grandTotalTax !== null && (
              <div className="bg-card ml-auto rounded-lg border px-4 py-2 text-sm">
                <div className="text-muted-foreground text-xs">Total Tax Collected</div>
                <div className="text-lg font-semibold">
                  {currencySymbol}
                  {grandTotalTax.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <DataTable<GstSummaryRow>
            resource="reports/gst-summary"
            getRowId={(row) => row.hsnCode}
            filters={filters}
            emptyMessage="No taxed sales match these filters."
            columns={[
              { key: "hsnCode", header: "HSN Code" },
              { key: "description", header: "Description" },
              {
                key: "taxableValue",
                header: "Taxable Value",
                render: (row) => `${currencySymbol}${row.taxableValue.toFixed(2)}`,
              },
              {
                key: "cgstAmount",
                header: "CGST",
                render: (row) => `${currencySymbol}${row.cgstAmount.toFixed(2)}`,
              },
              {
                key: "sgstAmount",
                header: "SGST",
                render: (row) => `${currencySymbol}${row.sgstAmount.toFixed(2)}`,
              },
              {
                key: "igstAmount",
                header: "IGST",
                render: (row) => `${currencySymbol}${row.igstAmount.toFixed(2)}`,
              },
              {
                key: "totalTax",
                header: "Total Tax",
                render: (row) => `${currencySymbol}${row.totalTax.toFixed(2)}`,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
