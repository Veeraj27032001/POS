"use client";

import { useEffect, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PriceHistoryRow {
  id: string;
  price: string;
  changedAt: string;
}

export function ProductPriceHistory({ productId }: { productId: string }) {
  const [rows, setRows] = useState<PriceHistoryRow[]>([]);

  useEffect(() => {
    fetch(`/api/products/${productId}/price-history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: PriceHistoryRow[] } | null) => setRows(body?.data ?? []));
  }, [productId]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Selling price history</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Price</TableHead>
            <TableHead>Changed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.price}</TableCell>
              <TableCell>{new Date(row.changedAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
