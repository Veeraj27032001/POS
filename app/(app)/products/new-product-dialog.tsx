"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

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
import { productCreateSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type ProductCreateInput = z.infer<typeof productCreateSchema>;

export function NewProductDialog() {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateResource();
  const categories = useOptionsList("categories", "name");
  const taxCodes = useOptionsList("tax-codes", "code");
  const uoms = useOptionsList("uoms", "name");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema) as never,
    defaultValues: { trackExpiry: false, images: [], stockTracked: true },
  });

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Product</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Product</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Maggi 10rs Pack" {...register("name")} />
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
              {errors.categoryId && (
                <p className="text-sm text-red-600">{errors.categoryId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tax code (HSN)</Label>
              <Controller
                name="taxCodeId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={taxCodes}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Select tax code…"
                  />
                )}
              />
              {errors.taxCodeId && (
                <p className="text-sm text-red-600">{errors.taxCodeId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Unit of measure</Label>
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
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
              />
              {errors.price && <p className="text-sm text-red-600">{errors.price.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skuBarcode">Manufacturer barcode (optional)</Label>
              <Input id="skuBarcode" {...register("skuBarcode")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reorderLevel">Reorder level (optional)</Label>
              <Input
                id="reorderLevel"
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
                    id="trackExpiry"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <Label htmlFor="trackExpiry">Track expiry</Label>
                </div>
              )}
            />

            <Controller
              name="stockTracked"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="stockTracked"
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <Label htmlFor="stockTracked">Track stock</Label>
                </div>
              )}
            />
          </DialogFormBody>

          <DialogFormActions>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
