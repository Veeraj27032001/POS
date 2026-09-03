"use client";

import { useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockReportRow {
  productId: string;
  productName: string;
  systemBarcode: string;
  skuBarcode: string | null;
  categoryName: string | null;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  available: number;
}

export default function StockReportPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const warehouses = useOptionsList(
    selectedStoreId ? "warehouses" : "",
    "name",
    selectedStoreId ? `storeId=${selectedStoreId}` : undefined,
  );
  const categories = useOptionsList("categories", "name");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Stock Report</h1>
        <p className="text-muted-foreground text-sm">
          Current on-hand and available stock, per product and warehouse, for the selected store.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <>
          <div className="flex gap-3">
            <div className="w-56 space-y-1.5">
              <SearchableSelect
                options={warehouses}
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="All warehouses"
              />
            </div>
            <div className="w-56 space-y-1.5">
              <SearchableSelect
                options={categories}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="All categories"
              />
            </div>
          </div>

          <DataTable<StockReportRow>
            resource="reports/stock"
            getRowId={(row) => `${row.productId}:${row.warehouseId}`}
            searchable
            filters={{
              storeId: selectedStoreId,
              warehouseId: warehouseId ?? undefined,
              categoryId: categoryId ?? undefined,
            }}
            emptyMessage="No stock-tracked products match these filters."
            columns={[
              { key: "productName", header: "Product" },
              { key: "systemBarcode", header: "System Barcode" },
              {
                key: "skuBarcode",
                header: "Product Barcode",
                render: (row) => row.skuBarcode ?? "—",
              },
              { key: "categoryName", header: "Category", render: (row) => row.categoryName ?? "—" },
              { key: "warehouseName", header: "Warehouse" },
              { key: "onHand", header: "On Hand" },
              { key: "available", header: "Available" },
            ]}
          />
        </>
      )}
    </div>
  );
}
