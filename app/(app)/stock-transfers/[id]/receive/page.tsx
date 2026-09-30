"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { LoadingState } from "@/components/loading-state";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stockTransferReceiveSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type StockTransferReceiveInput = z.infer<typeof stockTransferReceiveSchema>;

interface ExistingStockTransfer {
  status: string;
  destinationStoreId: string;
  items: {
    id: string;
    productName: string;
    productBarcode: string;
    quantity: number;
  }[];
}

export default function ReceiveStockTransferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidateResource();
  const warehouses = useOptionsList("warehouses", "name");
  const [loaded, setLoaded] = useState<"pending" | "ready" | "not_receivable" | "not_found">(
    "pending",
  );
  const [items, setItems] = useState<ExistingStockTransfer["items"]>([]);

  const {
    handleSubmit,
    control,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockTransferReceiveInput>({
    resolver: zodResolver(stockTransferReceiveSchema) as never,
    defaultValues: { items: [] },
  });
  const { fields } = useFieldArray({ control, name: "items" });
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/stock-transfers/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: ExistingStockTransfer | null) => {
        if (!body) {
          setLoaded("not_found");
          return;
        }
        if (body.status !== "pending") {
          setLoaded("not_receivable");
          return;
        }
        setItems(body.items);
        reset({
          receivedDate: new Date().toISOString().slice(0, 10),
          items: body.items.map((item) => ({
            itemId: item.id,
            quantityAccepted: item.quantity,
            quantityRejected: 0,
            destinationWarehouseId: "",
          })),
        });
        setLoaded("ready");
      });
  }, [id, reset]);

  async function onSubmit(values: StockTransferReceiveInput) {
    const res = await fetch(`/api/stock-transfers/${id}/receive`, {
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
    toast.success("Stock transfer received.");
    router.push(`/stock-transfers/${id}`);
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href={`/stock-transfers/${id}`}
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Stock Transfer
      </Link>

      {loaded === "pending" && <LoadingState />}
      {loaded === "not_found" && <p className="text-muted-foreground">Record not found.</p>}
      {loaded === "not_receivable" && (
        <p className="text-muted-foreground">
          This transfer is no longer pending — it can&apos;t be received.
        </p>
      )}

      {loaded === "ready" && (
        <form onSubmit={handleSubmit(guardedSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Receive Stock Transfer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="receivedDate">
                  Received date
                  <RequiredMark />
                </Label>
                <Input
                  id="receivedDate"
                  type="date"
                  data-kbd-item=""
                  {...register("receivedDate")}
                />
                {errors.receivedDate && (
                  <p className="text-sm text-red-600">{errors.receivedDate.message}</p>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_100px_100px_1fr] gap-2 border-b p-3 text-xs font-medium">
                  <span>Product</span>
                  <span>Accepted</span>
                  <span>Rejected</span>
                  <span>Destination storage</span>
                </div>
                <div className="divide-y">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_100px_100px_1fr] items-center gap-2 p-3"
                    >
                      <div className="text-sm">
                        <div className="font-medium">{items[index]?.productName}</div>
                        <div className="text-muted-foreground text-xs">
                          {items[index]?.productBarcode} · sent {items[index]?.quantity}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        data-kbd-item=""
                        {...register(`items.${index}.quantityAccepted`, {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                      <Input
                        type="number"
                        min={0}
                        data-kbd-item=""
                        {...register(`items.${index}.quantityRejected`, {
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                      <Controller
                        name={`items.${index}.destinationWarehouseId`}
                        control={control}
                        render={({ field: f }) => (
                          <SearchableSelect
                            data-kbd-item=""
                            options={warehouses}
                            value={f.value ?? null}
                            onChange={(v) => f.onChange(v ?? "")}
                            placeholder="Select storage…"
                          />
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {errors.items && !Array.isArray(errors.items) && (
                <p className="text-sm text-red-600">{errors.items.message}</p>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Link
                href={`/stock-transfers/${id}`}
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
