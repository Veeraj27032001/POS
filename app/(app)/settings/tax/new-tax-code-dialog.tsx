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
import { taxCodeCreateSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";

type TaxCodeCreateInput = z.infer<typeof taxCodeCreateSchema>;

export function NewTaxCodeDialog() {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateResource();
  const schemes = useOptionsList("tax-schemes", "name");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaxCodeCreateInput>({
    resolver: zodResolver(taxCodeCreateSchema) as never,
  });

  async function onSubmit(values: TaxCodeCreateInput) {
    const res = await fetch("/api/tax-codes", {
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
    invalidate("tax-codes");
    toast.success("Tax code created.");
  }

  const guardedSubmit = useSubmitGuard(onSubmit);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Tax Code</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Tax Code</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Scheme
                <RequiredMark />
              </Label>
              <Controller
                name="schemeId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={schemes}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    placeholder="Select scheme…"
                  />
                )}
              />
              {errors.schemeId && <p className="text-sm text-red-600">{errors.schemeId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">
                Code (HSN)
                <RequiredMark />
              </Label>
              <Input id="code" {...register("code")} />
              {errors.code && <p className="text-sm text-red-600">{errors.code.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description
                <RequiredMark />
              </Label>
              <Input id="description" {...register("description")} />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="componentGroup">
                Component group
                <RequiredMark />
              </Label>
              <Input
                id="componentGroup"
                placeholder="CGST_SGST or IGST"
                {...register("componentGroup")}
              />
              {errors.componentGroup && (
                <p className="text-sm text-red-600">{errors.componentGroup.message}</p>
              )}
            </div>
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
