"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { ProductSelectWithStock } from "@/components/product-select-with-stock";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import type { PickedItem } from "@/components/stock-inward-pickup-dialog";
import { StockInwardPickupDialog } from "@/components/stock-inward-pickup-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/datetime/currency";
import { stockInwardCreateSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockInwardCreateInput = z.infer<typeof stockInwardCreateSchema>;

export default function NewStockInwardPage() {
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const suppliers = useOptionsList("suppliers", "name");
  const products = useOptionsList("products", "name");
  const [linkedDocumentNumber, setLinkedDocumentNumber] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<StockInwardCreateInput>({
    resolver: zodResolver(stockInwardCreateSchema) as never,
    defaultValues: {
      inwardDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: "", quantityAccepted: 1 }],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function handleAddItem() {
    append({ productId: "", quantityAccepted: 1 });
  }

  function handlePicked(result: {
    purchaseOrderId: string;
    documentNumber: string;
    supplierId: string;
    items: PickedItem[];
  }) {
    setValue("purchaseOrderId", result.purchaseOrderId);
    setValue("supplierId", result.supplierId);
    setLinkedDocumentNumber(result.documentNumber);
    replace(
      result.items.map((item) => ({
        productId: item.productId,
        quantityAccepted: item.quantity,
        unitCost: item.unitCost,
      })),
    );
  }

  function unlinkPurchaseOrder() {
    setValue("purchaseOrderId", null);
    setLinkedDocumentNumber(null);
  }

  async function applySupplierCost(index: number, productId: string) {
    const supplierId = getValues("supplierId");
    if (!supplierId || !productId) return;
    if (getValues(`items.${index}.unitCost`)) return;

    const res = await fetch(`/api/products/${productId}/supplier-prices`);
    if (!res.ok) return;
    const body = (await res.json()) as { data: { supplierId: string; cost: string }[] };
    const match = body.data.find((p) => p.supplierId === supplierId);
    if (match) {
      setValue(`items.${index}.unitCost`, Number(match.cost));
    }
  }

  async function onSubmit(values: StockInwardCreateInput) {
    const res = await fetch("/api/stock-inwards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-inwards");
    toast.success("Stock inward recorded.");
    router.push("/stock-inwards");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  const grandTotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = Number(item?.quantityAccepted) || 0;
    const cost = Number(item?.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/stock-inwards"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Inward
      </Link>

      <form onSubmit={handleSubmit(guardedSubmit)}>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xl">New Stock Inward</CardTitle>
            <StockInwardPickupDialog onPicked={handlePicked} />
          </CardHeader>
          <CardContent className="space-y-6">
            {linkedDocumentNumber && (
              <div className="bg-primary/5 border-primary/30 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>
                  Picked up from <span className="font-medium">{linkedDocumentNumber}</span>
                </span>
                <button
                  type="button"
                  data-kbd-item=""
                  onClick={unlinkPurchaseOrder}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}

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
                <Label htmlFor="inwardDate">
                  Inward date
                  <RequiredMark />
                </Label>
                <Input id="inwardDate" type="date" data-kbd-item="" {...register("inwardDate")} />
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
                      data-kbd-item=""
                    />
                  )}
                />
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
                  onClick={handleAddItem}
                >
                  <PlusIcon className="size-3.5" />
                  Add item
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_90px_90px_110px_100px_auto] gap-2 border-b p-3 text-xs font-medium">
                  <span>Product</span>
                  <span>Accepted</span>
                  <span>Rejected</span>
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
                        className="grid grid-cols-[1fr_90px_90px_110px_100px_auto] items-center gap-2 p-3"
                      >
                        <Controller
                          name={`items.${index}.productId`}
                          control={control}
                          render={({ field: f }) => (
                            <ProductSelectWithStock
                              value={f.value}
                              onChange={(v) => {
                                f.onChange(v);
                                if (v) void applySupplierCost(index, v);
                              }}
                              products={products}
                              warehouseId={warehouseId}
                              data-kbd-item=""
                            />
                          )}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Accepted"
                          data-kbd-item=""
                          {...register(`items.${index}.quantityAccepted`, {
                            valueAsNumber: true,
                            min: 0,
                          })}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Rejected"
                          data-kbd-item=""
                          {...register(`items.${index}.quantityRejected`, {
                            min: 0,
                            setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                          })}
                        />
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Cost"
                          data-kbd-item=""
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
                          data-kbd-item=""
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
              href="/stock-inwards"
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
