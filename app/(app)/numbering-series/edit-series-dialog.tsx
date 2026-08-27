"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

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
import { numberingSeriesUpdateSchema } from "@/lib/masters/schemas";

type SeriesUpdateInput = z.infer<typeof numberingSeriesUpdateSchema>;

export interface EditSeriesDialogProps {
  id: string;
  prefix: string | null;
  currentNumber: number;
  onSaved: () => void;
}

export function EditSeriesDialog({ id, prefix, currentNumber, onSaved }: EditSeriesDialogProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SeriesUpdateInput>({
    resolver: zodResolver(numberingSeriesUpdateSchema) as never,
    defaultValues: { prefix: prefix ?? "", currentNumber },
  });

  async function onSubmit(values: SeriesUpdateInput) {
    const res = await fetch(`/api/numbering-series/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    setOpen(false);
    onSaved();
    toast.success("Numbering series updated.");
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
          <DialogTitle>Edit Numbering Series</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(guardedSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogFormBody>
            <div className="space-y-1.5">
              <Label htmlFor="edit-prefix">Prefix</Label>
              <Input id="edit-prefix" placeholder="e.g. CB" {...register("prefix")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-currentNumber">Current number</Label>
              <Input
                id="edit-currentNumber"
                type="number"
                {...register("currentNumber", {
                  setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                })}
              />
              <p className="text-muted-foreground text-xs">
                The next document uses this number, then increments it. Only correct this after
                manually removing transactional records from the database.
              </p>
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
