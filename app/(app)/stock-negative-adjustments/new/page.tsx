"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { stockNegativeAdjustmentCreateSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockNegativeAdjustmentCreateInput = z.infer<typeof stockNegativeAdjustmentCreateSchema>;

export default function NewStockNegativeAdjustmentPage() {
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const products = useOptionsList("products", "name");
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=stock_adjustment");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StockNegativeAdjustmentCreateInput>({
    resolver: zodResolver(stockNegativeAdjustmentCreateSchema) as never,
    defaultValues: {
      adjustmentDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: "", quantity: 1, reasonCodeId: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function onSubmit(values: StockNegativeAdjustmentCreateInput) {
    const res = await fetch("/api/stock-negative-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-negative-adjustments");
    toast.success("Negative adjustment recorded.");
    router.push("/stock-negative-adjustments");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-negative-adjustments"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Negative Adjustment
      </Link>

      <form onSubmit={handleSubmit(guardedSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">New Negative Adjustment</CardTitle>
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
                      data-kbd-item=""
                    />
                  )}
                />
                {errors.warehouseId && (
                  <p className="text-sm text-red-600">{errors.warehouseId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustmentDate">
                  Adjustment date
                  <RequiredMark />
                </Label>
                <Input
                  id="adjustmentDate"
                  type="date"
                  data-kbd-item=""
                  {...register("adjustmentDate")}
                />
                {errors.adjustmentDate && (
                  <p className="text-sm text-red-600">{errors.adjustmentDate.message}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" data-kbd-item="" {...register("notes")} />
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
                  data-kbd-item=""
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
                            data-kbd-item=""
                          />
                        )}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Qty"
                        data-kbd-item=""
                        {...register(`items.${index}.quantity`, { valueAsNumber: true, min: 0 })}
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
                            data-kbd-item=""
                          />
                        )}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        data-kbd-item=""
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
              href="/stock-negative-adjustments"
              data-kbd-item=""
              className="text-muted-foreground text-sm hover:underline"
            >
              Cancel
            </Link>
            <Button type="submit" data-kbd-item="" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
