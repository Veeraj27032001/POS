"use client";

import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPrintBridge } from "@/lib/adapters/print";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource, useListCount, usePaginatedList } from "@/lib/pagination/useList";
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

const PLACEHOLDER_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, var(--color-secondary), var(--color-secondary) 8px, var(--color-card) 8px, var(--color-card) 16px)",
};

const GRID_COLS = 3;
const PAGE_SIZE = 12;

function ProductThumbnail({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return <div className="h-24 w-full" style={PLACEHOLDER_STYLE} />;
  }

  return (
    <div className="group/thumb bg-secondary relative h-24 w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[index]} alt="" className="size-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
            }}
            className="absolute inset-y-0 left-0 flex w-7 items-center justify-center bg-black/20 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
            }}
            className="absolute inset-y-0 right-0 flex w-7 items-center justify-center bg-black/20 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100"
          >
            <ChevronRightIcon className="size-4" />
          </button>
          <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={cn("size-1.5 rounded-full", i === index ? "bg-white" : "bg-white/50")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
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
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const categories = useOptionsList("categories", "name");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const gridRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-navcard]", cols: GRID_COLS });

  const filters = categoryId ? { categoryId } : {};
  const countQuery = useListCount({ resource: "products", pageSize: PAGE_SIZE, search, filters });
  const listQuery = usePaginatedList<ProductRow>({
    resource: "products",
    page,
    pageSize: PAGE_SIZE,
    search,
    filters,
  });

  useEffect(() => {
    setPage(1);
  }, [search, categoryId]);

  const totalPages = listQuery.data?.totalPages ?? countQuery.data?.totalPages ?? 1;
  const totalRecords = listQuery.data?.totalRecords ?? countQuery.data?.totalRecords;
  const products = listQuery.data?.data ?? [];

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
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          {totalRecords !== undefined && (
            <p className="text-muted-foreground text-sm">{totalRecords} products in catalog</p>
          )}
        </div>
        <NewProductDialog />
      </div>

      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search products by name or barcode…"
        className="max-w-sm"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setCategoryId(null);
            setPage(1);
          }}
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
            onClick={() => {
              setCategoryId(category.value);
              setPage(1);
            }}
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

      {listQuery.isPending && (
        <div className="text-muted-foreground py-12 text-center text-sm">Loading products…</div>
      )}

      {!listQuery.isPending && products.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
            <div className="size-16 rounded-2xl" style={PLACEHOLDER_STYLE} />
            <p className="font-semibold">No products found</p>
            <p className="text-muted-foreground text-sm">
              Try a different search or category, or add your first product.
            </p>
          </div>
        </Card>
      )}

      {products.length > 0 && (
        <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card
              key={product.id}
              tabIndex={0}
              data-navcard
              onClick={() => router.push(`/products/${product.id}`)}
              className="focus-visible:outline-ring cursor-pointer overflow-hidden py-0 transition-[transform,box-shadow] outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ProductThumbnail images={product.images} />
              <div className="space-y-2 p-3.5">
                <div>
                  <p className="truncate text-sm font-bold">{product.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {product.skuBarcode ?? product.systemBarcode}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-base font-extrabold">₹{product.price}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      product.stockTracked
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {product.stockTracked ? "Tracked" : "Untracked"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => printLabel(product)}>
                    Print Label
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={togglingId === product.id}
                    onClick={() => handleToggleActive(product)}
                  >
                    {togglingId === product.id && <Loader2Icon className="size-3.5 animate-spin" />}
                    {product.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingId === product.id}
                    onClick={() => handleDelete(product)}
                  >
                    {deletingId === product.id && <Loader2Icon className="size-3.5 animate-spin" />}
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
