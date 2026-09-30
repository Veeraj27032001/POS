"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockPositiveAdjustmentRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  adjustmentDate: string;
}

export default function StockPositiveAdjustmentsPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Positive Adjustment</h1>
        <Link href="/stock-positive-adjustments/new" data-kbd-item="" className={buttonVariants()}>
          New Positive Adjustment
        </Link>
      </div>

      <DataTable<StockPositiveAdjustmentRow>
        resource="stock-positive-adjustments"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Storage",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "adjustmentDate",
            header: "Adjustment date",
            render: (row) => formatDateOnly(toDateOnly(row.adjustmentDate)),
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Link
                href={`/stock-positive-adjustments/${row.id}`}
                data-kbd-item=""
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
