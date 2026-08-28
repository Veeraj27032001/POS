"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { ProductSelectWithStock } from "@/components/product-select-with-stock";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/lib/datetime/dateOnly";
import { stockDamageEditSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockDamageEditInput = z.infer<typeof stockDamageEditSchema>;

interface ExistingStockDamage {
  warehouseId: string;
  damageDate: string;
  notes: string | null;
  items: { productId: string; quantity: number; reasonCodeId: string }[];
}

export default function EditStockDamagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const products = useOptionsList("products", "name");
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=damage");
  const [loaded, setLoaded] = useState<"pending" | "ready" | "not_found">("pending");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockDamageEditInput>({
    resolver: zodResolver(stockDamageEditSchema) as never,
    defaultValues: { items: [{ productId: "", quantity: 1, reasonCodeId: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = useWatch({ control, name: "warehouseId" });

  useEffect(() => {
    fetch(`/api/stock-damages/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ExistingStockDamage | null) => {
        if (!body) {
          setLoaded("not_found");
          return;
        }
        reset({
          warehouseId: body.warehouseId,
          damageDate: toDateOnly(body.damageDate),
          notes: body.notes ?? undefined,
          items: body.items,
        });
        setLoaded("ready");
      });
  }, [id, reset]);

  async function onSubmit(values: StockDamageEditInput) {
    const res = await fetch(`/api/stock-damages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-damages");
    toast.success("Stock damage updated.");
    router.push(`/stock-damages/${id}`);
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div className="space-y-4 p-8">
      <Link href={`/stock-damages/${id}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to Stock Damage
      </Link>

      {loaded === "pending" && <p className="text-muted-foreground">Loading…</p>}
      {loaded === "not_found" && <p className="text-muted-foreground">Record not found.</p>}

      {loaded === "ready" && (
        <form onSubmit={handleSubmit(guardedSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Edit Stock Damage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Warehouse
                    <RequiredMark />
                  </Label>
                  <Controller
                    name="warehouseId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        options={warehouses}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Select warehouse…"
                      />
                    )}
                  />
                  {errors.warehouseId && (
                    <p className="text-sm text-red-600">{errors.warehouseId.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="damageDate">
                    Damage date
                    <RequiredMark />
                  </Label>
                  <Input id="damageDate" type="date" {...register("damageDate")} />
                  {errors.damageDate && (
                    <p className="text-sm text-red-600">{errors.damageDate.message}</p>
                  )}
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
                    onClick={() => append({ productId: "", quantity: 1, reasonCodeId: "" })}
                  >
                    <PlusIcon className="size-3.5" />
                    Add item
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_100px_1fr_auto] gap-2 border-b p-3 text-xs font-medium">
                    <span>Product</span>
                    <span>Quantity</span>
                    <span>Reason</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_100px_1fr_auto] items-center gap-2 p-3"
                      >
                        <Controller
                          name={`items.${index}.productId`}
                          control={control}
                          render={({ field: f }) => (
                            <ProductSelectWithStock
                              value={f.value}
                              onChange={f.onChange}
                              products={products}
                              warehouseId={warehouseId}
                            />
                          )}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Qty"
                          {...register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                            min: 0,
                          })}
                        />
                        <Controller
                          name={`items.${index}.reasonCodeId`}
                          control={control}
                          render={({ field: f }) => (
                            <SearchableSelect
                              options={reasonCodes}
                              value={f.value ?? null}
                              onChange={(v) => f.onChange(v ?? "")}
                              placeholder="Select reason…"
                            />
                          )}
                        />
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
                    ))}
                  </div>
                </div>
                {errors.items && !Array.isArray(errors.items) && (
                  <p className="text-sm text-red-600">{errors.items.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Link
                href={`/stock-damages/${id}`}
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
