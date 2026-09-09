"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockInwardRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  supplierId: string | null;
  inwardDate: string;
}

export default function StockInwardsPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const suppliers = useOptionsList("suppliers", "name");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock Inward</h1>
        <Link href="/stock-inwards/new" data-kbd-item="" className={buttonVariants()}>
          New Stock Inward
        </Link>
      </div>

      <DataTable<StockInwardRow>
        resource="stock-inwards"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Warehouse",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "supplierId",
            header: "Supplier",
            render: (row) => suppliers.find((s) => s.value === row.supplierId)?.label ?? "—",
          },
          {
            key: "inwardDate",
            header: "Inward date",
            render: (row) => formatDateOnly(toDateOnly(row.inwardDate)),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/stock-inwards/${row.id}`}
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
