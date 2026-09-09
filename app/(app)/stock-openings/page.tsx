"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockOpeningRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  openingDate: string;
}

export default function StockOpeningsPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Opening Balance</h1>
        <Link href="/stock-openings/new" data-kbd-item="" className={buttonVariants()}>
          New Opening Balance
        </Link>
      </div>

      <DataTable<StockOpeningRow>
        resource="stock-openings"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Warehouse",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "openingDate",
            header: "Opening date",
            render: (row) => formatDateOnly(toDateOnly(row.openingDate)),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/stock-openings/${row.id}`}
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
