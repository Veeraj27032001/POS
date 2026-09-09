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
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { productCreateSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useTaxPreferences } from "@/lib/masters/useTaxPreferences";
import { useInvalidateResource } from "@/lib/pagination/useList";

type ProductCreateInput = z.infer<typeof productCreateSchema>;

export function NewProductDialog() {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateResource();
  const categories = useOptionsList("categories", "name");
  const hsnCodes = useOptionsList("hsn-codes/options", "hsnCode");
  const uoms = useOptionsList("uoms", "name");
  const preferences = useTaxPreferences();
  const hsnEnabled = preferences?.hsnTaxDisplayEnabled ?? false;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema) as never,
    defaultValues: { images: [], stockTracked: true },
  });
  const selectedHsnCodeId = watch("hsnCodeId");

  async function onSubmit(values: ProductCreateInput) {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    setOpen(false);
    reset();
    invalidate("products");
    toast.success("Product created.");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);
  // No onBoundaryLeft — this renders inside a portaled dialog; Escape
  // already backs out natively, so the first field shouldn't eject focus
  // to the sidebar underneath it.
  const kbdRef = useArrowKeyNav<HTMLFormElement>({ selector: "[data-kbd-item]" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button data-kbd-item="">New Product</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Product</DialogTitle>
        </DialogHeader>
        <form
          ref={kbdRef}
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">
                Name
                <RequiredMark />
              </Label>
              <Input
                id="name"
                data-kbd-item=""
                placeholder="e.g. Maggi 10rs Pack"
                {...register("name")}
              />
              {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    data-kbd-item=""
                    options={categories}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    placeholder="Select category…"
                  />
                )}
              />
              {errors.categoryId && (
                <p className="text-sm text-red-600">{errors.categoryId.message}</p>
              )}
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
                      data-kbd-item=""
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
                    data-kbd-item=""
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
              <Label htmlFor="price">
                Price
                <RequiredMark />
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                data-kbd-item=""
                {...register("price", { valueAsNumber: true })}
              />
              {errors.price && <p className="text-sm text-red-600">{errors.price.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skuBarcode">Manufacturer barcode (optional)</Label>
              <Input id="skuBarcode" data-kbd-item="" {...register("skuBarcode")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reorderLevel">Reorder level (optional)</Label>
              <Input
                id="reorderLevel"
                type="number"
                data-kbd-item=""
                {...register("reorderLevel", {
                  setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                })}
              />
              {errors.reorderLevel && (
                <p className="text-sm text-red-600">{errors.reorderLevel.message}</p>
              )}
            </div>

            <Controller
              name="stockTracked"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="stockTracked"
                    data-kbd-item=""
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <Label htmlFor="stockTracked">Track stock</Label>
                </div>
              )}
            />
          </DialogFormBody>

          <DialogFormActions>
            <Button type="submit" data-kbd-item="" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
