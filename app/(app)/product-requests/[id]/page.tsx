"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { PRODUCT_REQUEST_STATUS_LABELS } from "@/lib/documents/productRequestStatus";
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
import { cn } from "@/lib/utils";

interface ProductRequestItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantityRequested: number;
  quantityReceived: number;
  expectedUnitCost: string | null;
}

interface ProductRequestRow {
  id: string;
  documentNumber: string;
  supplierId: string;
  requestDate: string;
  status: string;
  items: ProductRequestItemRow[];
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/15 text-primary",
  partially_received: "bg-warning/15 text-warning",
  received: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export default function ProductRequestViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<ProductRequestRow | null | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const suppliers = useOptionsList("suppliers", "name");

  function refresh() {
    fetch(`/api/product-requests/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }

  useEffect(refresh, [id]);

  async function updateStatus(status: "sent" | "cancelled" | "draft") {
    setUpdating(true);
    try {
      const res = await fetch(`/api/product-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update.");
        return;
      }
      refresh();
      invalidate("product-requests");
      const messages = {
        sent: "Request approved.",
        cancelled: "Request cancelled.",
        draft: "Request reverted to draft.",
      };
      toast.success(messages[status]);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this product request? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/product-requests/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("product-requests");
      toast.success("Product request deleted.");
      router.push("/product-requests");
    } finally {
      setDeleting(false);
    }
  }

  const canRevert =
    row &&
    (row.status === "sent" || row.status === "cancelled") &&
    row.items.every((item) => item.quantityReceived === 0);

  return (
    <div className="space-y-4 p-8">
      <Link href="/product-requests" className="text-muted-foreground text-sm hover:underline">
        ← Back to Product Requests
      </Link>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  STATUS_STYLES[row.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {PRODUCT_REQUEST_STATUS_LABELS[row.status] ?? row.status}
              </span>
            </div>
            <div className="flex gap-2">
              {row.status === "draft" && (
                <Link
                  href={`/product-requests/${row.id}/edit`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
              )}
              {row.status === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updating}
                  onClick={() => updateStatus("sent")}
                >
                  {updating && <Loader2Icon className="size-3.5 animate-spin" />}
                  Approve
                </Button>
              )}
              {canRevert && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updating}
                  onClick={() => updateStatus("draft")}
                >
                  {updating && <Loader2Icon className="size-3.5 animate-spin" />}
                  Revert to Draft
                </Button>
              )}
              {(row.status === "draft" ||
                row.status === "sent" ||
                row.status === "partially_received") && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={updating}
                  onClick={() => updateStatus("cancelled")}
                >
                  {updating && <Loader2Icon className="size-3.5 animate-spin" />}
                  Cancel
                </Button>
              )}
              {row.status === "draft" && (
                <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
                  {deleting && <Loader2Icon className="size-3.5 animate-spin" />}
                  Delete
                </Button>
              )}
            </div>
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            {[
              ["Supplier", lookupLabel(suppliers, row.supplierId)],
              ["Request date", formatDateOnly(toDateOnly(row.requestDate))],
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
                  <TableHead>Requested</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Expected cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productBarcode}</TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.quantityReceived}</TableCell>
                    <TableCell>{item.expectedUnitCost ?? "—"}</TableCell>
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
