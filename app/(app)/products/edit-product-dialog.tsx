"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { ProductHsnTaxDetails } from "@/components/product-hsn-tax-details";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFormActions,
  DialogFormBody,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { productUpdateSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useTaxPreferences } from "@/lib/masters/useTaxPreferences";

type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export interface EditProductDialogProps {
  id: string;
  name: string;
  categoryId: string | null;
  hsnCodeId: string | null;
  uomId: string;
  price: string;
  skuBarcode: string | null;
  reorderLevel: number | null;
  trackExpiry: boolean;
  stockTracked: boolean;
  onSaved: (updated: Record<string, unknown>) => void;
}

export function EditProductDialog(props: EditProductDialogProps) {
  const { id, onSaved, ...current } = props;
  const [open, setOpen] = useState(false);
  const categories = useOptionsList("categories", "name");
  const hsnCodes = useOptionsList("hsn-codes/options", "hsnCode");
  const uoms = useOptionsList("uoms", "name");
  const preferences = useTaxPreferences();
  const hsnEnabled = preferences?.hsnTaxDisplayEnabled ?? false;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductUpdateInput>({
    resolver: zodResolver(productUpdateSchema) as never,
    defaultValues: {
      name: current.name,
      categoryId: current.categoryId,
      hsnCodeId: current.hsnCodeId,
      uomId: current.uomId,
      price: Number(current.price),
      skuBarcode: current.skuBarcode ?? undefined,
      reorderLevel: current.reorderLevel ?? undefined,
      trackExpiry: current.trackExpiry,
      stockTracked: current.stockTracked,
    },
  });
  const selectedHsnCodeId = watch("hsnCodeId");

  async function onSubmit(values: ProductUpdateInput) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    const updated = await res.json();
    setOpen(false);
    onSaved(updated);
    toast.success("Product updated.");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-name">
                Name
                <RequiredMark />
              </Label>
              <Input id="edit-name" {...register("name")} />
              {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={categories}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="Select category…"
                  />
                )}
              />
            </div>

            {hsnEnabled && (
              <div className="space-y-1.5">
                <Label>
                  HSN code
                  <RequiredMark />
                </Label>
                <Controller
                  name="hsnCodeId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={hsnCodes}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? "")}
                      placeholder="Select HSN code…"
                    />
                  )}
                />
                {errors.hsnCodeId && (
                  <p className="text-sm text-red-600">{errors.hsnCodeId.message}</p>
                )}
              </div>
            )}

            {hsnEnabled && <ProductHsnTaxDetails hsnCodeId={selectedHsnCodeId} />}

            <div className="space-y-1.5">
              <Label>
                Unit of measure
                <RequiredMark />
              </Label>
              <Controller
                name="uomId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={uoms}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Select UOM…"
                  />
                )}
              />
              {errors.uomId && <p className="text-sm text-red-600">{errors.uomId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-price">
                Price
                <RequiredMark />
              </Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
              />
              {errors.price && <p className="text-sm text-red-600">{errors.price.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-skuBarcode">Manufacturer barcode (optional)</Label>
              <Input id="edit-skuBarcode" {...register("skuBarcode")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-reorderLevel">Reorder level (optional)</Label>
              <Input
                id="edit-reorderLevel"
                type="number"
                {...register("reorderLevel", {
                  setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                })}
              />
              {errors.reorderLevel && (
                <p className="text-sm text-red-600">{errors.reorderLevel.message}</p>
              )}
            </div>

            <Controller
              name="trackExpiry"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="edit-trackExpiry"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <Label htmlFor="edit-trackExpiry">Track expiry</Label>
                </div>
              )}
            />

            <Controller
              name="stockTracked"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="edit-stockTracked"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <Label htmlFor="edit-stockTracked">Track stock</Label>
                </div>
              )}
            />
          </DialogFormBody>

          <DialogFormActions>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
