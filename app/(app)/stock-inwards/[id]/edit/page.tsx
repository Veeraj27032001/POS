"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/datetime/currency";
import { toDateOnly } from "@/lib/datetime/dateOnly";
import { stockInwardEditSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockInwardEditInput = z.infer<typeof stockInwardEditSchema>;

interface ExistingStockInward {
  purchaseOrderId: string | null;
  warehouseId: string;
  supplierId: string | null;
  inwardDate: string;
  notes: string | null;
  items: {
    productId: string;
    quantityAccepted: number;
    quantityRejected: number | null;
    expiryDate: string | null;
    unitCost: string | null;
  }[];
}

export default function EditStockInwardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const suppliers = useOptionsList("suppliers", "name");
  const products = useOptionsList("products", "name");
  const [loaded, setLoaded] = useState<"pending" | "ready" | "not_editable" | "not_found">(
    "pending",
  );
  const [warehouseId, setWarehouseId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockInwardEditInput>({
    resolver: zodResolver(stockInwardEditSchema) as never,
    defaultValues: { items: [{ productId: "", quantityAccepted: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  useEffect(() => {
    fetch(`/api/stock-inwards/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ExistingStockInward | null) => {
        if (!body) {
          setLoaded("not_found");
          return;
        }
        if (body.purchaseOrderId) {
          setLoaded("not_editable");
          return;
        }
        setWarehouseId(body.warehouseId);
        reset({
          warehouseId: body.warehouseId,
          supplierId: body.supplierId ?? undefined,
          inwardDate: toDateOnly(body.inwardDate),
          notes: body.notes ?? undefined,
          items: body.items.map((item) => ({
            productId: item.productId,
            quantityAccepted: item.quantityAccepted,
            quantityRejected: item.quantityRejected ?? undefined,
            expiryDate: item.expiryDate ? toDateOnly(item.expiryDate) : undefined,
            unitCost: item.unitCost != null ? Number(item.unitCost) : undefined,
          })),
        });
        setLoaded("ready");
      });
  }, [id, reset]);

  async function onSubmit(values: StockInwardEditInput) {
    const res = await fetch(`/api/stock-inwards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-inwards");
    toast.success("Stock inward updated.");
    router.push(`/stock-inwards/${id}`);
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  const grandTotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = Number(item?.quantityAccepted) || 0;
    const cost = Number(item?.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  return (
    <div className="space-y-4 p-8">
      <Link href={`/stock-inwards/${id}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to Stock Inward
      </Link>

      {loaded === "pending" && <p className="text-muted-foreground">Loading…</p>}
      {loaded === "not_found" && <p className="text-muted-foreground">Record not found.</p>}
      {loaded === "not_editable" && (
        <p className="text-muted-foreground">
          This stock inward can&apos;t be edited — it&apos;s linked to a product request.
        </p>
      )}

      {loaded === "ready" && (
        <form onSubmit={handleSubmit(guardedSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Edit Stock Inward</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Warehouse</Label>
                  <Input
                    disabled
                    value={warehouses.find((w) => w.value === warehouseId)?.label ?? ""}
                  />
                  <p className="text-muted-foreground text-xs">
                    Can&apos;t be changed here — use Stock Transfer to move stock between
                    warehouses.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inwardDate">
                    Inward date
                    <RequiredMark />
                  </Label>
                  <Input id="inwardDate" type="date" {...register("inwardDate")} />
                  {errors.inwardDate && (
                    <p className="text-sm text-red-600">{errors.inwardDate.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <Controller
                    name="supplierId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        options={suppliers}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? null)}
                        placeholder="Select supplier…"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...register("notes")} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Items
                    <RequiredMark />
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ productId: "", quantityAccepted: 1 })}
                  >
                    <PlusIcon className="size-3.5" />
                    Add item
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_90px_90px_130px_110px_100px_auto] gap-2 border-b p-3 text-xs font-medium">
                    <span>Product</span>
                    <span>Accepted</span>
                    <span>Rejected</span>
                    <span>Expiry date</span>
                    <span>Unit cost</span>
                    <span>Total</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {fields.map((field, index) => {
                      const qty = Number(watchedItems?.[index]?.quantityAccepted) || 0;
                      const cost = Number(watchedItems?.[index]?.unitCost) || 0;
                      return (
                        <div
                          key={field.id}
                          className="grid grid-cols-[1fr_90px_90px_130px_110px_100px_auto] items-center gap-2 p-3"
                        >
                          <Controller
                            name={`items.${index}.productId`}
                            control={control}
                            render={({ field: f }) => (
                              <SearchableSelect
                                options={products}
                                value={f.value ?? null}
                                onChange={(v) => f.onChange(v ?? "")}
                                placeholder="Select product…"
                              />
                            )}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Accepted"
                            {...register(`items.${index}.quantityAccepted`, {
                              valueAsNumber: true,
                              min: 0,
                            })}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Rejected"
                            {...register(`items.${index}.quantityRejected`, {
                              min: 0,
                              setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                            })}
                          />
                          <Input
                            type="date"
                            {...register(`items.${index}.expiryDate`, {
                              setValueAs: (v) => (v === "" ? undefined : v),
                            })}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Cost"
                            {...register(`items.${index}.unitCost`, {
                              min: 0,
                              setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                            })}
                          />
                          <span className="text-sm font-medium">
                            {qty && cost ? formatCurrency(qty * cost) : "—"}
                          </span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            disabled={fields.length === 1}
                            onClick={() => remove(index)}
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-muted/40 flex justify-end gap-3 border-t p-3 text-sm">
                    <span className="text-muted-foreground">Grand total</span>
                    <span className="font-semibold">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
                {errors.items && !Array.isArray(errors.items) && (
                  <p className="text-sm text-red-600">{errors.items.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Link
                href={`/stock-inwards/${id}`}
                className="text-muted-foreground text-sm hover:underline"
              >
                Cancel
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}
