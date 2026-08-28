"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockNegativeAdjustmentRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  adjustmentDate: string;
}

export default function StockNegativeAdjustmentsPage() {
  const warehouses = useOptionsList("warehouses", "name");

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Negative Adjustment</h1>
        <Link href="/stock-negative-adjustments/new" className={buttonVariants()}>
          New Negative Adjustment
        </Link>
      </div>

      <DataTable<StockNegativeAdjustmentRow>
        resource="stock-negative-adjustments"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Warehouse",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "adjustmentDate",
            header: "Adjustment date",
            render: (row) => formatDateOnly(toDateOnly(row.adjustmentDate)),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/stock-negative-adjustments/${row.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
