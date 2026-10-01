"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
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
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";
import { cn } from "@/lib/utils";

interface StockBlockItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantityBlocked: number;
  reasonCodeId: string;
  status: string;
}

interface StockBlockRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  reviewByDate: string | null;
  blockedAt: string;
  items: StockBlockItemRow[];
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function StockBlockViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<StockBlockRow | null | undefined>(undefined);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses/options", "name");
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=stock_block");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function refresh() {
    fetch(`/api/stock-blocks/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }

  useEffect(refresh, [id]);

  async function releaseItem(itemId: string) {
    setReleasingId(itemId);
    try {
      const res = await fetch(`/api/stock-blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to release.");
        return;
      }
      refresh();
      toast.success("Item released.");
    } finally {
      setReleasingId(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this stock block? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-blocks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("stock-blocks");
      toast.success("Stock block deleted.");
      router.push("/stock-blocks");
    } finally {
      setDeleting(false);
    }
  }

  const allActive = row ? row.items.every((item) => item.status === "active") : false;

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-blocks"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Block
      </Link>

      {row === undefined && <LoadingState />}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
            {allActive && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/stock-blocks/${row.id}/edit`}
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
              ["Blocked on", formatDateOnly(toDateOnly(row.blockedAt))],
              [
                "Review by date",
                row.reviewByDate ? formatDateOnly(toDateOnly(row.reviewByDate)) : "—",
              ],
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
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productBarcode}</TableCell>
                    <TableCell>{item.quantityBlocked}</TableCell>
                    <TableCell>{lookupLabel(reasonCodes, item.reasonCodeId)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                          item.status === "active"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          data-kbd-item=""
                          disabled={releasingId === item.id}
                          onClick={() => releaseItem(item.id)}
                        >
                          {releasingId === item.id && (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          )}
                          Release
                        </Button>
                      )}
                    </TableCell>
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
