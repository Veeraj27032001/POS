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

interface StockQualityCheckItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  reasonCodeId: string;
}

interface StockQualityCheckRow {
  id: string;
  documentNumber: string;
  warehouseId: string;
  checkDate: string;
  notes: string | null;
  items: StockQualityCheckItemRow[];
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function StockQualityCheckViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<StockQualityCheckRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses/options", "name");
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=quality_check");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/stock-quality-checks/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm("Delete this quality check record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock-quality-checks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("stock-quality-checks");
      toast.success("Quality check deleted.");
      router.push("/stock-quality-checks");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-quality-checks"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Quality Check
      </Link>

      {row === undefined && <LoadingState />}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/stock-quality-checks/${row.id}/edit`}
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
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            {[
              ["Storage", lookupLabel(warehouses, row.warehouseId)],
              ["Check date", formatDateOnly(toDateOnly(row.checkDate))],
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
