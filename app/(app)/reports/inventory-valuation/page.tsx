"use client";

import { useEffect, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface InventoryValuationRow {
  productId: string;
  productName: string;
  systemBarcode: string;
  categoryName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  onHand: number;
  unitCost: number;
  value: number;
}

export default function InventoryValuationReportPage() {
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
  const [groupByWarehouse, setGroupByWarehouse] = useState(true);
  const [totalValue, setTotalValue] = useState<number | null>(null);

  const filters = {
    storeId: selectedStoreId ?? undefined,
    warehouseId: warehouseId ?? undefined,
    categoryId: categoryId ?? undefined,
    groupByWarehouse: groupByWarehouse ? "1" : "0",
  };

  useEffect(() => {
    if (!selectedStoreId) {
      setTotalValue(null);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams({
      storeId: selectedStoreId,
      ...(warehouseId ? { warehouseId } : {}),
      ...(categoryId ? { categoryId } : {}),
      groupByWarehouse: groupByWarehouse ? "1" : "0",
      pageSize: "1",
    }).toString();
    fetch(`/api/reports/inventory-valuation?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { totalValue: number } | null) => {
        if (!cancelled) setTotalValue(data?.totalValue ?? null);
      })
      .catch(() => {
        if (!cancelled) setTotalValue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, warehouseId, categoryId, groupByWarehouse]);

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Inventory Valuation</h1>
        <p className="text-muted-foreground text-sm">
          On-hand quantity valued at default cost price — total stock value on the books.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <>
          <div className="flex flex-wrap items-end gap-3">
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
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="group-by-warehouse"
                checked={groupByWarehouse}
                onCheckedChange={(checked) => setGroupByWarehouse(Boolean(checked))}
              />
              <Label htmlFor="group-by-warehouse">Break down by warehouse</Label>
            </div>
            {totalValue !== null && (
              <div className="bg-card ml-auto rounded-lg border px-4 py-2 text-sm">
                <div className="text-muted-foreground text-xs">Total Stock Value</div>
                <div className="text-lg font-semibold">
                  {currencySymbol}
                  {totalValue.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <DataTable<InventoryValuationRow>
            resource="reports/inventory-valuation"
            getRowId={(row) => `${row.productId}:${row.warehouseId ?? "all"}`}
            searchable
            filters={filters}
            emptyMessage="No stock-tracked products match these filters."
            columns={[
              { key: "productName", header: "Product" },
              { key: "systemBarcode", header: "System Barcode" },
              { key: "categoryName", header: "Category", render: (row) => row.categoryName ?? "—" },
              ...(groupByWarehouse ? [{ key: "warehouseName", header: "Warehouse" }] : []),
              { key: "onHand", header: "On Hand" },
              {
                key: "unitCost",
                header: "Unit Cost",
                render: (row) => `${currencySymbol}${row.unitCost.toFixed(2)}`,
              },
              {
                key: "value",
                header: "Value",
                render: (row) => `${currencySymbol}${row.value.toFixed(2)}`,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
