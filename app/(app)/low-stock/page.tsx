"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { SearchableSelect } from "@/components/searchable-select";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface LowStockRow {
  productId: string;
  productName: string;
  productBarcode: string;
  reorderLevel: number;
  available: number;
}

export default function LowStockPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Low Stock</h1>
        <p className="text-muted-foreground text-sm">
          Products at or below their reorder level for the selected warehouse.
        </p>
      </div>

      <div className="max-w-xs space-y-1.5">
        <SearchableSelect
          options={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
          placeholder="Select warehouse…"
        />
      </div>

      {!warehouseId && (
        <p className="text-muted-foreground text-sm">Select a warehouse to check its stock.</p>
      )}

      {warehouseId && (
        <DataTable<LowStockRow>
          resource="stock/low-stock"
          getRowId={(row) => row.productId}
          searchable
          filters={{ warehouseId }}
          emptyMessage="Nothing is at or below its reorder level here."
          columns={[
            { key: "productName", header: "Product" },
            { key: "productBarcode", header: "Barcode" },
            { key: "available", header: "Available" },
            { key: "reorderLevel", header: "Reorder level" },
            {
              key: "status",
              header: "",
              render: (row) =>
                row.available <= 0 ? (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <AlertTriangleIcon className="size-3.5" />
                    Out of stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <AlertTriangleIcon className="size-3.5" />
                    Low
                  </span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
