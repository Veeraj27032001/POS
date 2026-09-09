"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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
import { stockTransferCreateSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockTransferCreateInput = z.infer<typeof stockTransferCreateSchema>;

export default function NewStockTransferPage() {
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const destinationStores = useOptionsList("stock-transfers/destination-stores", "name");
  const products = useOptionsList("products", "name");
  const [destinationKind, setDestinationKind] = useState<"warehouse" | "store">("warehouse");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StockTransferCreateInput>({
    resolver: zodResolver(stockTransferCreateSchema) as never,
    defaultValues: {
      destinationType: "warehouse",
      transferDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: "", quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const sourceWarehouseId = watch("sourceWarehouseId");
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function handleDestinationKindChange(kind: "warehouse" | "store") {
    setDestinationKind(kind);
    setValue("destinationType", kind);
    setValue("destinationId", "");
  }

  async function onSubmit(values: StockTransferCreateInput) {
    const res = await fetch("/api/stock-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-transfers");
    toast.success(
      destinationKind === "warehouse" ? "Stock transfer completed." : "Stock transfer requested.",
    );
    router.push("/stock-transfers");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-transfers"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Transfer
      </Link>

      <form onSubmit={handleSubmit(guardedSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">New Stock Transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Source warehouse
                  <RequiredMark />
                </Label>
                <Controller
                  name="sourceWarehouseId"
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
                {errors.sourceWarehouseId && (
                  <p className="text-sm text-red-600">{errors.sourceWarehouseId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transferDate">
                  Transfer date
                  <RequiredMark />
                </Label>
                <Input
                  id="transferDate"
                  type="date"
                  data-kbd-item=""
                  {...register("transferDate")}
                />
                {errors.transferDate && (
                  <p className="text-sm text-red-600">{errors.transferDate.message}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Destination
                  <RequiredMark />
                </Label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      data-kbd-item=""
                      checked={destinationKind === "warehouse"}
                      onChange={() => handleDestinationKindChange("warehouse")}
                    />
                    Same store — another warehouse
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      data-kbd-item=""
                      checked={destinationKind === "store"}
                      onChange={() => handleDestinationKindChange("store")}
                    />
                    Different store
                  </label>
                </div>
                <Controller
                  name="destinationId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={
                        destinationKind === "warehouse"
                          ? warehouses.filter((w) => w.value !== sourceWarehouseId)
                          : destinationStores
                      }
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? "")}
                      placeholder={
                        destinationKind === "warehouse"
                          ? "Select destination warehouse…"
                          : "Select destination store…"
                      }
                      data-kbd-item=""
                    />
                  )}
                />
                {errors.destinationId && (
                  <p className="text-sm text-red-600">{errors.destinationId.message}</p>
                )}
                {destinationKind === "store" && (
                  <p className="text-muted-foreground text-xs">
                    The destination store will receive this as a pending request — the stock stays
                    blocked at the source warehouse until they accept, reject, or you cancel it.
                  </p>
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
                  onClick={() => append({ productId: "", quantity: 1 })}
                >
                  <PlusIcon className="size-3.5" />
                  Add item
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_100px_auto] gap-2 border-b p-3 text-xs font-medium">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span />
                </div>
                <div className="divide-y">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_100px_auto] items-center gap-2 p-3"
                    >
                      <Controller
                        name={`items.${index}.productId`}
                        control={control}
                        render={({ field: f }) => (
                          <ProductSelectWithStock
                            value={f.value}
                            onChange={f.onChange}
                            products={products}
                            warehouseId={sourceWarehouseId}
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
              href="/stock-transfers"
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
