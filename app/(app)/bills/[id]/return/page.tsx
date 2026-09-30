"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
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
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface ReturnLineOption {
  id: string;
  productName: string;
  productBarcode: string;
  unitPrice: string;
  quantitySold: number;
  alreadyReturned: number;
  remaining: number;
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

function emptyRow(): RowState {
  return { quantity: "", condition: "sellable", warehouseId: null };
}

export default function BillReturnFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<ReturnFormData | null | undefined>(undefined);
  const [rowsByLine, setRowsByLine] = useState<Record<string, RowState[]>>({});
  const [reasonCodeId, setReasonCodeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=return");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/bills/${id}/return`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ReturnFormData | null) => {
        setForm(body);
        if (body) {
          const initial: Record<string, RowState[]> = {};
          for (const line of body.lines) {
            initial[line.id] = [emptyRow()];
          }
          setRowsByLine(initial);
        }
      });
  }, [id]);

  function updateRow(lineId: string, index: number, patch: Partial<RowState>) {
    setRowsByLine((prev) => {
      const rows = [...(prev[lineId] ?? [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, [lineId]: rows };
    });
  }

  function addRow(lineId: string) {
    setRowsByLine((prev) => ({ ...prev, [lineId]: [...(prev[lineId] ?? []), emptyRow()] }));
  }

  function removeRow(lineId: string, index: number) {
    setRowsByLine((prev) => {
      const rows = (prev[lineId] ?? []).filter((_, i) => i !== index);
      return { ...prev, [lineId]: rows.length > 0 ? rows : [emptyRow()] };
    });
  }

  async function handleSubmit() {
    if (!form) return;
    if (!reasonCodeId) {
      toast.error("Select a return reason.");
      return;
    }

    const lines: {
      billLineId: string;
      quantity: number;
      condition: Condition;
      warehouseId: string;
    }[] = [];
    for (const line of form.lines) {
      for (const row of rowsByLine[line.id] ?? []) {
        const quantity = Number(row.quantity) || 0;
        if (quantity === 0) continue;
        if (!row.warehouseId) {
          toast.error(`Select a warehouse for ${line.productName}.`);
          return;
        }
        lines.push({
          billLineId: line.id,
          quantity,
          condition: row.condition,
          warehouseId: row.warehouseId,
        });
      }
    }

    if (lines.length === 0) {
      toast.error("Enter a quantity for at least one item.");
      return;
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
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href={`/bills/${id}`}
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to bill
      </Link>

      {form === undefined && <LoadingState />}
      {form === null && <p className="text-muted-foreground">Bill not found.</p>}

      {form && (
        <>
          <h1 className="text-2xl font-semibold">Return items — {form.bill.documentNumber}</h1>

          {form.lines.every((l) => l.remaining === 0) ? (
            <p className="text-muted-foreground">
              Every item on this bill has already been returned.
            </p>
          ) : (
            <div className="space-y-3">
              {form.lines
                .filter((l) => l.remaining > 0)
                .map((line) => {
                  const rows = rowsByLine[line.id] ?? [];
                  return (
                    <div key={line.id} className="rounded-lg border">
                      <div className="bg-muted/40 flex items-center justify-between border-b p-3">
                        <div>
                          <div className="font-medium">{line.productName}</div>
                          <div className="text-muted-foreground text-xs">{line.productBarcode}</div>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Sold {line.quantitySold} · Remaining {line.remaining}
                        </div>
                      </div>
                      <div className="divide-y">
                        {rows.map((row, index) => (
                          <div key={index} className="flex flex-wrap items-center gap-3 p-3">
                            <Input
                              type="number"
                              min={0}
                              max={line.remaining}
                              data-kbd-item=""
                              value={row.quantity}
                              onChange={(e) =>
                                updateRow(line.id, index, { quantity: e.target.value })
                              }
                              className="w-20"
                            />
                            <Select
                              value={row.condition}
                              onValueChange={(v) =>
                                v && updateRow(line.id, index, { condition: v as Condition })
                              }
                              items={[
                                { value: "sellable", label: "Sellable" },
                                { value: "damaged", label: "Damaged" },
                              ]}
                            >
                              <SelectTrigger className="w-32" data-kbd-item="">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sellable">Sellable</SelectItem>
                                <SelectItem value="damaged">Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                            <SearchableSelect
                              data-kbd-item=""
                              options={form.warehouses.map((w) => ({
                                value: w.id,
                                label: w.name,
                              }))}
                              value={row.warehouseId}
                              onChange={(v) => updateRow(line.id, index, { warehouseId: v })}
                              placeholder="Select storage…"
                              className="w-48"
                            />
                            {rows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-kbd-item=""
                                onClick={() => removeRow(line.id, index)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="p-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-kbd-item=""
                          onClick={() => addRow(line.id)}
                        >
                          + Split across another storage location
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="max-w-sm space-y-1.5">
            <Label>
              Reason
              <RequiredMark />
            </Label>
            <SearchableSelect
              data-kbd-item=""
              options={reasonCodes}
              value={reasonCodeId}
              onChange={setReasonCodeId}
              placeholder="Select a reason…"
            />
          </div>

          <Button data-kbd-item="" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Recording…" : "Record Return"}
          </Button>
        </>
      )}
    </div>
  );
}
