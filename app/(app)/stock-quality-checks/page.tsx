"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockQualityCheckRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  checkDate: string;
}

export default function StockQualityChecksPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quality Check</h1>
        <Link href="/stock-quality-checks/new" data-kbd-item="" className={buttonVariants()}>
          New Quality Check
        </Link>
      </div>

      <DataTable<StockQualityCheckRow>
        resource="stock-quality-checks"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Warehouse",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "checkDate",
            header: "Check date",
            render: (row) => formatDateOnly(toDateOnly(row.checkDate)),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/stock-quality-checks/${row.id}`}
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
