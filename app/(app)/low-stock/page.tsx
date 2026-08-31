"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { SearchableSelect } from "@/components/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface LowStockRow {
  productId: string;
  productName: string;
  productBarcode: string;
  reorderLevel: number;
  available: number;
}

export default function LowStockPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [rows, setRows] = useState<LowStockRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warehouseId) {
      setRows(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stock/low-stock?warehouseId=${warehouseId}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data: LowStockRow[] }) => {
        if (!cancelled) setRows(body.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  return (
    <div className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Low Stock</h1>
        <p className="text-muted-foreground text-sm">
          Products at or below their reorder level for the selected warehouse.
        </p>
      </div>

      <div className="max-w-xs space-y-1.5">
        <SearchableSelect
          options={warehouses}
          value={warehouseId}
          onChange={setWarehouseId}
          placeholder="Select warehouse…"
        />
      </div>

      {!warehouseId && (
        <p className="text-muted-foreground text-sm">Select a warehouse to check its stock.</p>
      )}
      {warehouseId && loading && <p className="text-muted-foreground text-sm">Checking stock…</p>}
      {warehouseId && !loading && rows && rows.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing is at or below its reorder level here.
        </p>
      )}

      {warehouseId && !loading && rows && rows.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reorder level</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>{row.productName}</TableCell>
                  <TableCell>{row.productBarcode}</TableCell>
                  <TableCell>{row.available}</TableCell>
                  <TableCell>{row.reorderLevel}</TableCell>
                  <TableCell>
                    {row.available <= 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangleIcon className="size-3.5" />
                        Out of stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangleIcon className="size-3.5" />
                        Low
                      </span>
                    )}
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
