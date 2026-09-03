"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { getPrintBridge } from "@/lib/adapters/print";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";
import { cn } from "@/lib/utils";

import { NewProductDialog } from "./new-product-dialog";

interface ProductRow {
  id: string;
  name: string;
  price: string;
  systemBarcode: string;
  skuBarcode: string | null;
  categoryId: string | null;
  stockTracked: boolean;
  isActive: boolean;
  images: string[];
}

async function printLabel(row: ProductRow) {
  await getPrintBridge().print({
    kind: "label",
    labels: [
      {
        barcodeValue: row.systemBarcode,
        productName: row.name,
        price: Number(row.price),
        copies: 1,
      },
    ],
  });
}

export default function ProductsPage() {
  const invalidate = useInvalidateResource();
  const categories = useOptionsList("categories", "name");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleToggleActive(row: ProductRow) {
    const activating = !row.isActive;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    setTogglingId(row.id);
    try {
      const res = await fetch(`/api/products/${row.id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      invalidate("products");
      toast.success(`Product ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(row: ProductRow) {
    if (
      !window.confirm(
        "Delete this product? It will be hidden everywhere in the system, including this list. This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/products/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("products");
      toast.success("Product deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <NewProductDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap",
            categoryId === null
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setCategoryId(category.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap",
              categoryId === category.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <DataTable<ProductRow>
        resource="products"
        getRowId={(row) => row.id}
        searchable
        filters={{ categoryId: categoryId ?? undefined }}
        emptyMessage="No products found. Try a different search or category, or add your first product."
        rowHref={(row) => `/products/${row.id}`}
        columns={[
          { key: "name", header: "Product" },
          {
            key: "barcode",
            header: "Barcode",
            render: (row) => row.skuBarcode ?? row.systemBarcode,
          },
          {
            key: "price",
            header: "Price",
            render: (row) => `₹${row.price}`,
          },
          {
            key: "stockTracked",
            header: "Stock",
            render: (row) => (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  row.stockTracked
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {row.stockTracked ? "Tracked" : "Untracked"}
              </span>
            ),
          },
          {
            key: "isActive",
            header: "Status",
            render: (row) => (row.isActive ? "Active" : "Inactive"),
          },
          {
            key: "__actions",
            header: "",
            render: (row) => (
              <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" onClick={() => printLabel(row)}>
                  Print Label
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={togglingId === row.id}
                  onClick={() => handleToggleActive(row)}
                >
                  {togglingId === row.id && <Loader2Icon className="size-3.5 animate-spin" />}
                  {row.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === row.id}
                  onClick={() => handleDelete(row)}
                >
                  {deletingId === row.id && <Loader2Icon className="size-3.5 animate-spin" />}
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
