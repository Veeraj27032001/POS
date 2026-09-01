"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface ReturnLineOption {
  id: string;
  productName: string;
  productBarcode: string;
  unitPrice: string;
  quantitySold: number;
  alreadyReturned: number;
  remaining: number;
  defaultWarehouseId: string | null;
}

interface ReturnFormData {
  bill: { id: string; documentNumber: string; customerId: string | null };
  lines: ReturnLineOption[];
  warehouses: { id: string; name: string }[];
}

type Condition = "sellable" | "damaged";

interface RowState {
  quantity: string;
  condition: Condition;
  warehouseId: string | null;
}

export default function BillReturnFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<ReturnFormData | null | undefined>(undefined);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [reasonCodeId, setReasonCodeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=return");

  useEffect(() => {
    fetch(`/api/bills/${id}/return`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ReturnFormData | null) => {
        setForm(body);
        if (body) {
          const initial: Record<string, RowState> = {};
          for (const line of body.lines) {
            initial[line.id] = {
              quantity: "",
              condition: "sellable",
              warehouseId: line.defaultWarehouseId,
            };
          }
          setRows(initial);
        }
      });
  }, [id]);

  function updateRow(lineId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  async function handleSubmit() {
    if (!form) return;
    if (!reasonCodeId) {
      toast.error("Select a return reason.");
      return;
    }
    const lines = form.lines
      .map((line) => {
        const row = rows[line.id];
        const quantity = Number(row?.quantity) || 0;
        return quantity > 0
          ? {
              billLineId: line.id,
              quantity,
              condition: row.condition,
              warehouseId: row.warehouseId,
            }
          : null;
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lines.length === 0) {
      toast.error("Enter a quantity for at least one item.");
      return;
    }
    for (const line of lines) {
      if (!line.warehouseId) {
        toast.error("Select a warehouse for every returned item.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bills/${id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCodeId, lines }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to create the return.");
        return;
      }
      const created = (await res.json()) as { id: string };
      toast.success("Return recorded.");
      router.push(`/bill-returns/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <Link href={`/bills/${id}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to bill
      </Link>

      {form === undefined && <p className="text-muted-foreground">Loading…</p>}
      {form === null && <p className="text-muted-foreground">Bill not found.</p>}

      {form && (
        <>
          <h1 className="text-2xl font-semibold">Return items — {form.bill.documentNumber}</h1>

          {form.lines.every((l) => l.remaining === 0) ? (
            <p className="text-muted-foreground">
              Every item on this bill has already been returned.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Return qty</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Warehouse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lines
                    .filter((l) => l.remaining > 0)
                    .map((line) => {
                      const row = rows[line.id];
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>{line.productName}</div>
                            <div className="text-muted-foreground text-xs">
                              {line.productBarcode}
                            </div>
                          </TableCell>
                          <TableCell>{line.quantitySold}</TableCell>
                          <TableCell>{line.remaining}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={line.remaining}
                              value={row?.quantity ?? ""}
                              onChange={(e) => updateRow(line.id, { quantity: e.target.value })}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row?.condition ?? "sellable"}
                              onValueChange={(v) =>
                                v && updateRow(line.id, { condition: v as Condition })
                              }
                              items={[
                                { value: "sellable", label: "Sellable" },
                                { value: "damaged", label: "Damaged" },
                              ]}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sellable">Sellable</SelectItem>
                                <SelectItem value="damaged">Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <SearchableSelect
                              options={form.warehouses.map((w) => ({ value: w.id, label: w.name }))}
                              value={row?.warehouseId ?? null}
                              onChange={(v) => updateRow(line.id, { warehouseId: v })}
                              placeholder="Select warehouse…"
                              className="w-48"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="max-w-sm space-y-1.5">
            <Label>
              Reason
              <RequiredMark />
            </Label>
            <SearchableSelect
              options={reasonCodes}
              value={reasonCodeId}
              onChange={setReasonCodeId}
              placeholder="Select a reason…"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Recording…" : "Record Return"}
          </Button>
        </>
      )}
    </div>
  );
}
