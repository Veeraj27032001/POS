"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LoadingState } from "@/components/loading-state";
import { buttonVariants } from "@/components/ui/button";
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

interface StaleBlockItemRow {
  id: string;
  stockBlockMainId: string;
  productName: string;
  productBarcode: string;
  quantityBlocked: number;
  stockBlockMain: {
    documentNumber: string;
    warehouseId: string;
    reviewByDate: string | null;
    blockedAt: string;
  };
}

function lookupLabel(options: { value: string; label: string }[], id: string) {
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function StaleStockBlocksPage() {
  const [rows, setRows] = useState<StaleBlockItemRow[] | undefined>(undefined);
  const warehouses = useOptionsList("warehouses", "name");

  useEffect(() => {
    fetch("/api/stock-blocks/stale")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: StaleBlockItemRow[] } | null) => setRows(body?.data ?? []));
  }, []);

  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-blocks"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Block
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stale Blocks</h1>
          <p className="text-muted-foreground text-sm">
            Active blocks past their review date, or unreviewed for over a week — nothing here
            releases automatically.
          </p>
        </div>
      </div>

      {rows === undefined && <LoadingState />}
      {rows && rows.length === 0 && (
        <p className="text-muted-foreground">No stale blocks right now.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction No.</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Blocked on</TableHead>
                <TableHead>Review by</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.stockBlockMain.documentNumber}</TableCell>
                  <TableCell>{lookupLabel(warehouses, item.stockBlockMain.warehouseId)}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.quantityBlocked}</TableCell>
                  <TableCell>{formatDateOnly(toDateOnly(item.stockBlockMain.blockedAt))}</TableCell>
                  <TableCell>
                    {item.stockBlockMain.reviewByDate
                      ? formatDateOnly(toDateOnly(item.stockBlockMain.reviewByDate))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/stock-blocks/${item.stockBlockMainId}`}
                      data-kbd-item=""
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
