"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockInwardItemRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantityAccepted: number;
  quantityRejected: number | null;
  expiryDate: string | null;
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
  const [row, setRow] = useState<StockInwardRow | null | undefined>(undefined);
  const warehouses = useOptionsList("warehouses", "name");
  const suppliers = useOptionsList("suppliers", "name");
  const purchaseOrders = useOptionsList("product-requests", "documentNumber");

  useEffect(() => {
    fetch(`/api/stock-inwards/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }, [id]);

  return (
    <div className="max-w-4xl space-y-4 p-8">
      <Link href="/stock-inwards" className="text-muted-foreground text-sm hover:underline">
        ← Back to Stock Inward
      </Link>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            {[
              ["Warehouse", lookupLabel(warehouses, row.warehouseId)],
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
                  <TableHead>Expiry date</TableHead>
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
                    <TableCell>{item.expiryDate?.slice(0, 10) ?? "—"}</TableCell>
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
