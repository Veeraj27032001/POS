"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
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
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useProductSupplierPrices } from "@/lib/masters/useProductSupplierPrices";

interface AddPriceInput {
  supplierId: string;
  cost: number;
}

export function ProductSupplierPricing({ productId }: { productId: string }) {
  const { prices, refresh } = useProductSupplierPrices(productId);
  const suppliers = useOptionsList("suppliers", "name");
  const [open, setOpen] = useState(false);
  const kbdRef = useArrowKeyNav<HTMLFormElement>({ selector: "[data-kbd-item]" });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddPriceInput>();

  async function onSubmit(values: AddPriceInput) {
    const res = await fetch(`/api/products/${productId}/supplier-prices`, {
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
    refresh();
    toast.success("Supplier price added.");
  }

  function supplierName(supplierId: string) {
    return suppliers.find((s) => s.value === supplierId)?.label ?? supplierId;
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Supplier pricing</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" data-kbd-item="">
                Add price
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add supplier price</DialogTitle>
            </DialogHeader>
            <form ref={kbdRef} onSubmit={handleSubmit(onSubmit)}>
              <DialogFormBody>
                <div className="space-y-1.5">
                  <Label>
                    Supplier
                    <RequiredMark />
                  </Label>
                  <Controller
                    name="supplierId"
                    control={control}
                    rules={{ required: true }}
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
                    <p className="text-sm text-red-600">Supplier is required.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cost">
                    Cost
                    <RequiredMark />
                  </Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min={0}
                    data-kbd-item=""
                    {...register("cost", { required: true, valueAsNumber: true, min: 0 })}
                  />
                  {errors.cost && (
                    <p className="text-sm text-red-600">Cost is required and cannot be negative.</p>
                  )}
                </div>
              </DialogFormBody>
              <DialogFormActions>
                <Button type="submit" data-kbd-item="" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
              </DialogFormActions>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {prices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No supplier prices recorded yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Recorded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{supplierName(row.supplierId)}</TableCell>
                <TableCell>{row.cost}</TableCell>
                <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
