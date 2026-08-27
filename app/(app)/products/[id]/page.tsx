"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProductHsnTaxDetails } from "@/components/product-hsn-tax-details";
import { ProductMediaManager } from "@/components/product-media-manager";
import { Button } from "@/components/ui/button";
import { getPrintBridge } from "@/lib/adapters/print";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useTaxPreferences } from "@/lib/masters/useTaxPreferences";
import { useInvalidateResource } from "@/lib/pagination/useList";
import { cn } from "@/lib/utils";

import { EditProductDialog } from "../edit-product-dialog";

interface ProductRow {
  id: string;
  name: string;
  categoryId: string | null;
  hsnCodeId: string | null;
  uomId: string;
  price: string;
  packSize: string | null;
  skuBarcode: string | null;
  systemBarcode: string;
  description: string | null;
  trackExpiry: boolean;
  stockTracked: boolean;
  reorderLevel: number | null;
  defaultCostPrice: string | null;
  isActive: boolean;
  images: string[];
  videos: string[];
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function ProductViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<ProductRow | null | undefined>(undefined);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const categories = useOptionsList("categories", "name");
  const hsnCodes = useOptionsList("hsn-codes/options", "hsnCode");
  const uoms = useOptionsList("uoms", "name");
  const preferences = useTaxPreferences();
  const hsnEnabled = preferences?.hsnTaxDisplayEnabled ?? false;

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setRow);
  }, [id]);

  async function handleToggleActive() {
    if (!row) return;
    const activating = !row.isActive;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    setToggling(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      const updated = (await res.json()) as ProductRow;
      setRow(updated);
      invalidate("products");
      toast.success(`Product ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this product? It will be hidden everywhere in the system, including this list. This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("products");
      toast.success("Product deleted.");
      router.push("/products");
    } finally {
      setDeleting(false);
    }
  }

  async function handlePrintLabel() {
    if (!row) return;
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

  return (
    <div className="max-w-5xl space-y-4 p-8">
      <Link href="/products" className="text-muted-foreground text-sm hover:underline">
        ← Back to Products
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Product details</h1>
          {row && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                row.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {row.isActive ? "Active" : "Inactive"}
            </span>
          )}
        </div>
        {row && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintLabel}>
              Print Label
            </Button>
            <EditProductDialog
              id={row.id}
              name={row.name}
              categoryId={row.categoryId}
              hsnCodeId={row.hsnCodeId}
              uomId={row.uomId}
              price={row.price}
              skuBarcode={row.skuBarcode}
              reorderLevel={row.reorderLevel}
              trackExpiry={row.trackExpiry}
              stockTracked={row.stockTracked}
              onSaved={(updated) => setRow((prev) => (prev ? { ...prev, ...updated } : prev))}
            />
            <Button variant="outline" size="sm" disabled={toggling} onClick={handleToggleActive}>
              {toggling && <Loader2Icon className="size-3.5 animate-spin" />}
              {row.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2Icon className="size-3.5 animate-spin" />}
              Delete
            </Button>
          </div>
        )}
      </div>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <div className="bg-card rounded-lg border p-4">
          <ProductMediaManager
            productId={row.id}
            images={row.images}
            videos={row.videos}
            onUpdated={(next) => {
              setRow((prev) => (prev ? { ...prev, ...next } : prev));
              invalidate("products");
            }}
          />
        </div>
      )}

      {row && (
        <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
          {[
            ["Name", row.name],
            ["Category", lookupLabel(categories, row.categoryId)],
            ...(hsnEnabled ? [["HSN code", lookupLabel(hsnCodes, row.hsnCodeId)]] : []),
            ["Unit of measure", lookupLabel(uoms, row.uomId)],
            ["Price", row.price],
            ["Default cost price", row.defaultCostPrice ?? "—"],
            ["Pack size", row.packSize ?? "—"],
            ["System barcode", row.systemBarcode],
            ["Manufacturer barcode", row.skuBarcode ?? "—"],
            ["Description", row.description ?? "—"],
            ["Reorder level", row.reorderLevel ?? "—"],
            ["Tracks expiry", row.trackExpiry ? "Yes" : "No"],
            ["Tracks stock", row.stockTracked ? "Yes" : "No"],
          ].map(([label, value]) => (
            <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {row && <ProductHsnTaxDetails hsnCodeId={row.hsnCodeId} />}
    </div>
  );
}
