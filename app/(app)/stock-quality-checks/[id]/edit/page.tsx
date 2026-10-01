"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { LoadingState } from "@/components/loading-state";
import { ProductSelectWithStock } from "@/components/product-select-with-stock";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/lib/datetime/dateOnly";
import { stockQualityCheckEditSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockQualityCheckEditInput = z.infer<typeof stockQualityCheckEditSchema>;

interface ExistingStockQualityCheck {
  warehouseId: string;
  checkDate: string;
  notes: string | null;
  items: { productId: string; quantity: number; reasonCodeId: string }[];
}

export default function EditStockQualityCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses/options", "name");
  const products = useOptionsList("products", "name");
  const reasonCodes = useOptionsList("reason-codes/options", "label", "category=quality_check");
  const [loaded, setLoaded] = useState<"pending" | "ready" | "not_found">("pending");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockQualityCheckEditInput>({
    resolver: zodResolver(stockQualityCheckEditSchema) as never,
    defaultValues: { items: [{ productId: "", quantity: 1, reasonCodeId: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/stock-quality-checks/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ExistingStockQualityCheck | null) => {
        if (!body) {
          setLoaded("not_found");
          return;
        }
        reset({
          warehouseId: body.warehouseId,
          checkDate: toDateOnly(body.checkDate),
          notes: body.notes ?? undefined,
          items: body.items,
        });
        setLoaded("ready");
      });
  }, [id, reset]);

  async function onSubmit(values: StockQualityCheckEditInput) {
    const res = await fetch(`/api/stock-quality-checks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-quality-checks");
    toast.success("Quality check updated.");
    router.push(`/stock-quality-checks/${id}`);
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href={`/stock-quality-checks/${id}`}
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Quality Check
      </Link>

      {loaded === "pending" && <LoadingState />}
      {loaded === "not_found" && <p className="text-muted-foreground">Record not found.</p>}

      {loaded === "ready" && (
        <form onSubmit={handleSubmit(guardedSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Edit Quality Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Storage
                    <RequiredMark />
                  </Label>
                  <Controller
                    name="warehouseId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        data-kbd-item=""
                        options={warehouses}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Select storage…"
                      />
                    )}
                  />
                  {errors.warehouseId && (
                    <p className="text-sm text-red-600">{errors.warehouseId.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="checkDate">
                    Check date
                    <RequiredMark />
                  </Label>
                  <Input id="checkDate" type="date" data-kbd-item="" {...register("checkDate")} />
                  {errors.checkDate && (
                    <p className="text-sm text-red-600">{errors.checkDate.message}</p>
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
                              data-kbd-item=""
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
                          data-kbd-item=""
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
                              data-kbd-item=""
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
                href={`/stock-quality-checks/${id}`}
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
      )}
    </div>
  );
}
