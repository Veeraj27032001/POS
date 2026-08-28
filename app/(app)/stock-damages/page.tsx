"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockDamageRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  damageDate: string;
}

export default function StockDamagesPage() {
  const warehouses = useOptionsList("warehouses", "name");

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock Damage</h1>
        <Link href="/stock-damages/new" className={buttonVariants()}>
          New Stock Damage
        </Link>
      </div>

      <DataTable<StockDamageRow>
        resource="stock-damages"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "warehouseId",
            header: "Warehouse",
            render: (row) => warehouses.find((w) => w.value === row.warehouseId)?.label ?? "—",
          },
          {
            key: "damageDate",
            header: "Damage date",
            render: (row) => formatDateOnly(toDateOnly(row.damageDate)),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/stock-damages/${row.id}`}
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
