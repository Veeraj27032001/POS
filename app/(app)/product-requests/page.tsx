"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface ProductRequestRow {
  id: string;
  documentNumber: string;
  supplierId: string;
  requestDate: string;
  status: string;
}

export default function ProductRequestsPage() {
  const suppliers = useOptionsList("suppliers", "name");

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Product Requests</h1>
        <Link href="/product-requests/new" className={buttonVariants()}>
          New Product Request
        </Link>
      </div>

      <DataTable<ProductRequestRow>
        resource="product-requests"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Transaction No." },
          {
            key: "supplierId",
            header: "Supplier",
            render: (row) => suppliers.find((s) => s.value === row.supplierId)?.label ?? "—",
          },
          {
            key: "requestDate",
            header: "Request date",
            render: (row) => formatDateOnly(toDateOnly(row.requestDate)),
          },
          { key: "status", header: "Status" },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <Link
                href={`/product-requests/${row.id}`}
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
