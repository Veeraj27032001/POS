"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

interface StockPositiveAdjustmentItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  reasonCodeId: string;
}

interface StockPositiveAdjustmentRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  notes: string | null;
  adjustmentDate: string;
  items: StockPositiveAdjustmentItemRow[];
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function StockPositiveAdjustmentViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<StockPositiveAdjustmentRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=stock_adjustment");

  useEffect(() => {
    fetch(`/api/stock-positive-adjustments/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm("Delete this positive adjustment record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-positive-adjustments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("stock-positive-adjustments");
      toast.success("Positive adjustment deleted.");
      router.push("/stock-positive-adjustments");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <Link
        href="/stock-positive-adjustments"
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Positive Adjustment
      </Link>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
            <div className="flex gap-2">
              <Link
                href={`/stock-positive-adjustments/${row.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit
              </Link>
              <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
                {deleting && <Loader2Icon className="size-3.5 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            {[
              ["Warehouse", lookupLabel(warehouses, row.warehouseId)],
              ["Adjustment date", formatDateOnly(toDateOnly(row.adjustmentDate))],
              ["Notes", row.notes ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productBarcode}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{lookupLabel(reasonCodes, item.reasonCodeId)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
