"use client";

import { useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface SalesReportRow {
  productId: string;
  productName: string;
  systemBarcode: string;
  skuBarcode: string | null;
  categoryName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  quantitySold: number;
  revenue: number;
}

export default function SalesReportPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const currencySymbol = useStoreCurrencySymbol();
  const warehouses = useOptionsList(
    selectedStoreId ? "warehouses" : "",
    "name",
    selectedStoreId ? `storeId=${selectedStoreId}` : undefined,
  );
  const categories = useOptionsList("categories", "name");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [groupByWarehouse, setGroupByWarehouse] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Sales Report</h1>
        <p className="text-muted-foreground text-sm">
          Quantity sold and revenue for the selected store — per product, or broken down by
          warehouse.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 space-y-1.5">
              <SearchableSelect
                data-kbd-item=""
                options={warehouses}
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="All storage locations"
              />
            </div>
            <div className="w-56 space-y-1.5">
              <SearchableSelect
                data-kbd-item=""
                options={categories}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="All categories"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                data-kbd-item=""
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                data-kbd-item=""
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="group-by-warehouse"
                data-kbd-item=""
                checked={groupByWarehouse}
                onCheckedChange={(checked) => setGroupByWarehouse(Boolean(checked))}
              />
              <Label htmlFor="group-by-warehouse">Break down by storage location</Label>
            </div>
          </div>

          <DataTable<SalesReportRow>
            resource="reports/sales"
            getRowId={(row) => `${row.productId}:${row.warehouseId ?? "all"}`}
            searchable
            filters={{
              storeId: selectedStoreId,
              warehouseId: warehouseId ?? undefined,
              categoryId: categoryId ?? undefined,
              groupByWarehouse: groupByWarehouse ? "1" : "0",
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            }}
            emptyMessage="No sales match these filters."
            columns={[
              { key: "productName", header: "Product" },
              { key: "systemBarcode", header: "System Barcode" },
              {
                key: "skuBarcode",
                header: "Product Barcode",
                render: (row) => row.skuBarcode ?? "—",
              },
              { key: "categoryName", header: "Category", render: (row) => row.categoryName ?? "—" },
              ...(groupByWarehouse ? [{ key: "warehouseName", header: "Storage" }] : []),
              { key: "quantitySold", header: "Qty Sold" },
              {
                key: "revenue",
                header: "Revenue",
                render: (row) => `${currencySymbol}${row.revenue.toFixed(2)}`,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
