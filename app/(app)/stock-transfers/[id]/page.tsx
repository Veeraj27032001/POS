"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { asAppSession } from "@/lib/auth/types";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";
import { cn } from "@/lib/utils";

interface StockTransferItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  destinationWarehouseId: string | null;
  quantityAccepted: number | null;
  quantityRejected: number | null;
}

interface StockTransferRow {
  id: string;
  documentNumber: string;
  storeId: string;
  sourceWarehouseId: string;
  destinationStoreId: string;
  status: string;
  requestedAt: string;
  respondedAt: string | null;
  receivedDate: string | null;
  cancelledAt: string | null;
  notes: string | null;
  items: StockTransferItemRow[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function StockTransferViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const [row, setRow] = useState<StockTransferRow | null | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const stores = useOptionsList("stock-transfers/destination-stores", "name");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function refresh() {
    fetch(`/api/stock-transfers/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }

  useEffect(refresh, [id]);

  async function respond(action: "cancel" | "reject") {
    setUpdating(true);
    try {
      const res = await fetch(`/api/stock-transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update.");
        return;
      }
      invalidate("stock-transfers");
      toast.success(action === "cancel" ? "Transfer cancelled." : "Transfer rejected.");
      router.push("/stock-transfers");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this stock transfer? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-transfers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("stock-transfers");
      toast.success("Stock transfer deleted.");
      router.push("/stock-transfers");
    } finally {
      setDeleting(false);
    }
  }

  const isSource = row && session?.user.storeId === row.storeId;
  const isDestination = row && session?.user.storeId === row.destinationStoreId;
  const isPending = row?.status === "pending";
  const canEdit = isSource && isPending;
  const canDelete = isSource && row?.status !== "accepted";

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-transfers"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Transfer
      </Link>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  STATUS_STYLES[row.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {STATUS_LABELS[row.status] ?? row.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Link
                  href={`/stock-transfers/${row.id}/edit`}
                  data-kbd-item=""
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
              )}
              {isPending && isDestination && (
                <>
                  <Link
                    href={`/stock-transfers/${row.id}/receive`}
                    data-kbd-item=""
                    className={buttonVariants({ size: "sm" })}
                  >
                    Receive
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-kbd-item=""
                    disabled={updating}
                    onClick={() => respond("reject")}
                  >
                    {updating && <Loader2Icon className="size-3.5 animate-spin" />}
                    Reject
                  </Button>
                </>
              )}
              {isPending && isSource && !isDestination && (
                <Button
                  variant="destructive"
                  size="sm"
                  data-kbd-item=""
                  disabled={updating}
                  onClick={() => respond("cancel")}
                >
                  {updating && <Loader2Icon className="size-3.5 animate-spin" />}
                  Cancel
                </Button>
              )}
              {canDelete && (
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
              )}
            </div>
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            {[
              ["Source warehouse", lookupLabel(warehouses, row.sourceWarehouseId)],
              ["Destination store", lookupLabel(stores, row.destinationStoreId)],
              ["Transfer date", formatDateOnly(toDateOnly(row.requestedAt))],
              [
                "Received date",
                row.receivedDate ? formatDateOnly(toDateOnly(row.receivedDate)) : "—",
              ],
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
                  <TableHead>Destination warehouse</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productBarcode}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{lookupLabel(warehouses, item.destinationWarehouseId)}</TableCell>
                    <TableCell>{item.quantityAccepted ?? "—"}</TableCell>
                    <TableCell>{item.quantityRejected ?? "—"}</TableCell>
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
