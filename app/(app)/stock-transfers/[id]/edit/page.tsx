"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/lib/datetime/dateOnly";
import { stockTransferEditSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockTransferEditInput = z.infer<typeof stockTransferEditSchema>;

interface ExistingStockTransfer {
  status: string;
  requestedAt: string;
  notes: string | null;
  items: { productId: string; quantity: number }[];
}

export default function EditStockTransferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const products = useOptionsList("products", "name");
  const [loaded, setLoaded] = useState<"pending" | "ready" | "not_editable" | "not_found">(
    "pending",
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockTransferEditInput>({
    resolver: zodResolver(stockTransferEditSchema) as never,
    defaultValues: { items: [{ productId: "", quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    fetch(`/api/stock-transfers/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ExistingStockTransfer | null) => {
        if (!body) {
          setLoaded("not_found");
          return;
        }
        if (body.status !== "pending") {
          setLoaded("not_editable");
          return;
        }
        reset({
          transferDate: toDateOnly(body.requestedAt),
          notes: body.notes ?? undefined,
          items: body.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
        setLoaded("ready");
      });
  }, [id, reset]);

  async function onSubmit(values: StockTransferEditInput) {
    const res = await fetch(`/api/stock-transfers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("stock-transfers");
    toast.success("Stock transfer updated.");
    router.push(`/stock-transfers/${id}`);
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div className="space-y-4 p-8">
      <Link
        href={`/stock-transfers/${id}`}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Transfer
      </Link>

      {loaded === "pending" && <p className="text-muted-foreground">Loading…</p>}
      {loaded === "not_found" && <p className="text-muted-foreground">Record not found.</p>}
      {loaded === "not_editable" && (
        <p className="text-muted-foreground">
          This transfer can only be edited while it&apos;s still pending.
        </p>
      )}

      {loaded === "ready" && (
        <form onSubmit={handleSubmit(guardedSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Edit Stock Transfer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="transferDate">
                    Transfer date
                    <RequiredMark />
                  </Label>
                  <Input id="transferDate" type="date" {...register("transferDate")} />
                  {errors.transferDate && (
                    <p className="text-sm text-red-600">{errors.transferDate.message}</p>
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
                            <SearchableSelect
                              options={products}
                              value={f.value ?? null}
                              onChange={(v) => f.onChange(v ?? "")}
                              placeholder="Select product…"
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
                href={`/stock-transfers/${id}`}
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
