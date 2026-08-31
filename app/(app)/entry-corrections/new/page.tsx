"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SOURCE_TYPE_CONFIG,
  type SourceItemType,
} from "@/lib/documents/entryCorrectionSourceTypes";
import { stockEntryCorrectionCreateSchema } from "@/lib/documents/schemas";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useInvalidateResource } from "@/lib/pagination/useList";

type EntryCorrectionCreateInput = z.infer<typeof stockEntryCorrectionCreateSchema>;

const SOURCE_TYPE_OPTIONS: SearchableSelectOption[] = (
  Object.keys(SOURCE_TYPE_CONFIG) as SourceItemType[]
).map((value) => ({ value, label: SOURCE_TYPE_CONFIG[value].label }));

export default function NewEntryCorrectionPage() {
  const router = useRouter();
  const invalidate = useInvalidateResource();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EntryCorrectionCreateInput>({
    resolver: zodResolver(stockEntryCorrectionCreateSchema) as never,
    defaultValues: { sourceItemType: undefined, sourceItemId: "", newValue: 0, notes: "" },
  });

  const sourceItemType = watch("sourceItemType");
  const sourceItemId = watch("sourceItemId");

  const [mainId, setMainId] = useState("");
  const [documents, setDocuments] = useState<SearchableSelectOption[]>([]);
  const [items, setItems] = useState<{ value: string; label: string; currentValue: number }[]>([]);

  useEffect(() => {
    setMainId("");
    setValue("sourceItemId", "");
    setDocuments([]);
    setItems([]);
    if (!sourceItemType) return;
    fetch(`/api/entry-corrections/source-documents?sourceItemType=${sourceItemType}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data: SearchableSelectOption[] }) => setDocuments(body.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceItemType]);

  useEffect(() => {
    setValue("sourceItemId", "");
    setItems([]);
    if (!sourceItemType || !mainId) return;
    fetch(`/api/entry-corrections/source-items?sourceItemType=${sourceItemType}&mainId=${mainId}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data: { value: string; label: string; currentValue: number }[] }) =>
        setItems(body.data),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceItemType, mainId]);

  const selectedItem = items.find((item) => item.value === sourceItemId);

  async function onSubmit(values: EntryCorrectionCreateInput) {
    const res = await fetch("/api/entry-corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    invalidate("entry-corrections");
    toast.success("Correction applied.");
    router.push("/entry-corrections");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <div className="space-y-4 p-8">
      <Link href="/entry-corrections" className="text-muted-foreground text-sm hover:underline">
        ← Back to Entry Correction
      </Link>

      <form onSubmit={handleSubmit(guardedSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">New Entry Correction</CardTitle>
            <p className="text-muted-foreground text-sm">
              Fixes a mistaken quantity on a document already saved — the source item is updated and
              this correction is logged for audit.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>
                  Source document type
                  <RequiredMark />
                </Label>
                <Controller
                  name="sourceItemType"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={SOURCE_TYPE_OPTIONS}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? "")}
                      placeholder="Select a document type…"
                    />
                  )}
                />
                {errors.sourceItemType && (
                  <p className="text-sm text-red-600">{errors.sourceItemType.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Document
                  <RequiredMark />
                </Label>
                <SearchableSelect
                  options={documents}
                  value={mainId || null}
                  onChange={(v) => setMainId(v ?? "")}
                  placeholder={
                    sourceItemType ? "Select a document…" : "Select a document type first"
                  }
                  disabled={!sourceItemType}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Item
                  <RequiredMark />
                </Label>
                <Controller
                  name="sourceItemId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      options={items}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      placeholder={mainId ? "Select an item…" : "Select a document first"}
                      disabled={!mainId}
                    />
                  )}
                />
                {errors.sourceItemId && (
                  <p className="text-sm text-red-600">{errors.sourceItemId.message}</p>
                )}
              </div>
            </div>

            {selectedItem && sourceItemType && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>
                    Current {SOURCE_TYPE_CONFIG[sourceItemType].fieldLabel.toLowerCase()}
                  </Label>
                  <Input value={selectedItem.currentValue} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newValue">
                    New {SOURCE_TYPE_CONFIG[sourceItemType].fieldLabel.toLowerCase()}
                    <RequiredMark />
                  </Label>
                  <Input
                    id="newValue"
                    type="number"
                    min={0}
                    {...register("newValue", { valueAsNumber: true, min: 0 })}
                  />
                  {errors.newValue && (
                    <p className="text-sm text-red-600">{errors.newValue.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Reason for correction
                <RequiredMark />
              </Label>
              <Textarea id="notes" {...register("notes")} />
              {errors.notes && <p className="text-sm text-red-600">{errors.notes.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Link
              href="/entry-corrections"
              className="text-muted-foreground text-sm hover:underline"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={isSubmitting || !selectedItem}>
              {isSubmitting ? "Saving…" : "Apply correction"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
