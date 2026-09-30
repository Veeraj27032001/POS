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
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toDateOnly } from "@/lib/datetime/dateOnly";
import { formatCurrency } from "@/lib/datetime/currency";
import { productRequestEditSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type ProductRequestEditInput = z.infer<typeof productRequestEditSchema>;

interface ExistingProductRequest {
  status: string;
  supplierId: string;
  requestDate: string;
  items: {
    productId: string;
    quantityRequested: number;
    expectedUnitCost: string | null;
  }[];
}

export default function EditProductRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const suppliers = useOptionsList("suppliers", "name");
  const products = useOptionsList("products", "name");
  const [loaded, setLoaded] = useState<"pending" | "ready" | "not_editable" | "not_found">(
    "pending",
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProductRequestEditInput>({
    resolver: zodResolver(productRequestEditSchema) as never,
    defaultValues: { items: [{ productId: "", quantityRequested: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/product-requests/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ExistingProductRequest | null) => {
        if (!body) {
          setLoaded("not_found");
          return;
        }
        if (body.status !== "draft") {
          setLoaded("not_editable");
          return;
        }
        reset({
          supplierId: body.supplierId,
          requestDate: toDateOnly(body.requestDate),
          items: body.items.map((item) => ({
            productId: item.productId,
            quantityRequested: item.quantityRequested,
            expectedUnitCost:
              item.expectedUnitCost != null ? Number(item.expectedUnitCost) : undefined,
          })),
        });
        setLoaded("ready");
      });
  }, [id, reset]);

  async function applySupplierCost(index: number, productId: string) {
    const supplierId = getValues("supplierId");
    if (!supplierId || !productId) return;
    if (getValues(`items.${index}.expectedUnitCost`)) return;

    const res = await fetch(`/api/products/${productId}/supplier-prices`);
    if (!res.ok) return;
    const body = (await res.json()) as { data: { supplierId: string; cost: string }[] };
    const match = body.data.find((p) => p.supplierId === supplierId);
    if (match) {
      setValue(`items.${index}.expectedUnitCost`, Number(match.cost));
    }
  }

  async function onSubmit(values: ProductRequestEditInput) {
    const res = await fetch(`/api/product-requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("product-requests");
    toast.success("Product request updated.");
    router.push(`/product-requests/${id}`);
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  const grandTotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = Number(item?.quantityRequested) || 0;
    const cost = Number(item?.expectedUnitCost) || 0;
    return sum + qty * cost;
  }, 0);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href={`/product-requests/${id}`}
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Product Request
      </Link>

      {loaded === "pending" && <LoadingState />}
      {loaded === "not_found" && <p className="text-muted-foreground">Record not found.</p>}
      {loaded === "not_editable" && (
        <p className="text-muted-foreground">
          This request can only be edited while it&apos;s still in draft.
        </p>
      )}

      {loaded === "ready" && (
        <form onSubmit={handleSubmit(guardedSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Edit Product Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Supplier
                    <RequiredMark />
                  </Label>
                  <Controller
                    name="supplierId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        data-kbd-item=""
                        options={suppliers}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Select supplier…"
                      />
                    )}
                  />
                  {errors.supplierId && (
                    <p className="text-sm text-red-600">{errors.supplierId.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="requestDate">
                    Request date
                    <RequiredMark />
                  </Label>
                  <Input
                    id="requestDate"
                    type="date"
                    data-kbd-item=""
                    {...register("requestDate")}
                  />
                  {errors.requestDate && (
                    <p className="text-sm text-red-600">{errors.requestDate.message}</p>
                  )}
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
                    onClick={() => append({ productId: "", quantityRequested: 1 })}
                  >
                    <PlusIcon className="size-3.5" />
                    Add item
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_100px_140px_140px_auto] gap-2 border-b p-3 text-xs font-medium">
                    <span>Product</span>
                    <span>Quantity</span>
                    <span>Cost / item</span>
                    <span>Total</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {fields.map((field, index) => {
                      const qty = Number(watchedItems?.[index]?.quantityRequested) || 0;
                      const cost = Number(watchedItems?.[index]?.expectedUnitCost) || 0;
                      return (
                        <div
                          key={field.id}
                          className="grid grid-cols-[1fr_100px_140px_140px_auto] items-center gap-2 p-3"
                        >
                          <Controller
                            name={`items.${index}.productId`}
                            control={control}
                            render={({ field: f }) => (
                              <SearchableSelect
                                data-kbd-item=""
                                options={products}
                                value={f.value ?? null}
                                onChange={(v) => {
                                  f.onChange(v ?? "");
                                  if (v) void applySupplierCost(index, v);
                                }}
                                placeholder="Select product…"
                              />
                            )}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Qty"
                            data-kbd-item=""
                            {...register(`items.${index}.quantityRequested`, {
                              valueAsNumber: true,
                              min: 0,
                            })}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Optional"
                            data-kbd-item=""
                            {...register(`items.${index}.expectedUnitCost`, {
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
                href={`/product-requests/${id}`}
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
