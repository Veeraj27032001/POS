"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

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
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { numberingSeriesCreateSchema, seriesTypeSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type SeriesCreateInput = z.infer<typeof numberingSeriesCreateSchema>;
const SERIES_TYPE_OPTIONS = seriesTypeSchema.options.map((value) => ({ value, label: value }));

export function NewSeriesDialog({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateResource();
  const financialYears = useOptionsList("financial-years-admin", "label");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SeriesCreateInput>({
    resolver: zodResolver(numberingSeriesCreateSchema) as never,
    defaultValues: { currentNumber: 0, storeId },
  });

  async function onSubmit(values: SeriesCreateInput) {
    const res = await fetch("/api/numbering-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, storeId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    setOpen(false);
    reset();
    invalidate("numbering-series");
    toast.success("Numbering series created.");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);
  const kbdRef = useArrowKeyNav<HTMLFormElement>({ selector: "[data-kbd-item]" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button data-kbd-item="">New Series</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Numbering Series</DialogTitle>
        </DialogHeader>
        <form
          ref={kbdRef}
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5">
              <Label>
                Document type
                <RequiredMark />
              </Label>
              <Controller
                name="seriesType"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    data-kbd-item=""
                    options={SERIES_TYPE_OPTIONS}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Select document type…"
                  />
                )}
              />
              {errors.seriesType && (
                <p className="text-sm text-red-600">{errors.seriesType.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Financial year
                <RequiredMark />
              </Label>
              <Controller
                name="financialYearId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    data-kbd-item=""
                    options={financialYears}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Select financial year…"
                  />
                )}
              />
              {errors.financialYearId && (
                <p className="text-sm text-red-600">{errors.financialYearId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prefix">Prefix</Label>
              <Input id="prefix" data-kbd-item="" placeholder="e.g. CB" {...register("prefix")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currentNumber">Starting number</Label>
              <Input
                id="currentNumber"
                type="number"
                data-kbd-item=""
                {...register("currentNumber", {
                  setValueAs: (v) => (v === "" || v === null ? 0 : Number(v)),
                })}
              />
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
  );
}
