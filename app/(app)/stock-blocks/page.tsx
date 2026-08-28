"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockBlockRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  blockedAt: string;
}

export default function StockBlocksPage() {
  const warehouses = useOptionsList("warehouses", "name");

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock Block</h1>
        <div className="flex gap-2">
          <Link href="/stock-blocks/stale" className={buttonVariants({ variant: "outline" })}>
            Stale Blocks
          </Link>
          <Link href="/stock-blocks/new" className={buttonVariants()}>
            New Stock Block
          </Link>
        </div>
      </div>

      <DataTable<StockBlockRow>
        resource="stock-blocks"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Warehouse",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "blockedAt",
            header: "Date",
            render: (row) => formatDateOnly(toDateOnly(row.blockedAt)),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/stock-blocks/${row.id}`}
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
