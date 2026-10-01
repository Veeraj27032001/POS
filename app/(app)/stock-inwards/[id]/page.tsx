"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

interface StockInwardItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantityAccepted: number;
  quantityRejected: number | null;
  unitCost: string | null;
}

interface StockInwardRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  supplierId: string | null;
  purchaseOrderId: string | null;
  inwardDate: string;
  notes: string | null;
  items: StockInwardItemRow[];
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function StockInwardViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<StockInwardRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses/options", "name");
  const suppliers = useOptionsList("suppliers", "name");
  const purchaseOrders = useOptionsList("product-requests", "documentNumber");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/stock-inwards/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm("Delete this stock inward record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-inwards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("stock-inwards");
      toast.success("Stock inward deleted.");
      router.push("/stock-inwards");
    } finally {
      setDeleting(false);
    }
  }

  const canEdit = row && !row.purchaseOrderId;

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-inwards"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Inward
      </Link>

      {row === undefined && <LoadingState />}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/stock-inwards/${row.id}/edit`}
                  data-kbd-item=""
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  data-kbd-item=""
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting && <Loader2Icon className="size-3.5 animate-spin" />}
                  Delete
                </Button>
              </div>
            )}
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            {[
              ["Storage", lookupLabel(warehouses, row.warehouseId)],
              ["Supplier", lookupLabel(suppliers, row.supplierId)],
              ["Product request", lookupLabel(purchaseOrders, row.purchaseOrderId)],
              ["Inward date", formatDateOnly(toDateOnly(row.inwardDate))],
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
                  <TableHead>Accepted</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Unit cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productBarcode}</TableCell>
                    <TableCell>{item.quantityAccepted}</TableCell>
                    <TableCell>{item.quantityRejected ?? "—"}</TableCell>
                    <TableCell>{item.unitCost ?? "—"}</TableCell>
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
