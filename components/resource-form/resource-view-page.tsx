"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { toast } from "sonner";
import type { ZodType } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useInvalidateResource } from "@/lib/pagination/useList";
import { cn } from "@/lib/utils";

import { ResourceForm } from "./resource-form";
import type { ResourceFieldConfig } from "./types";

function singularize(label: string): string {
  if (/ies$/.test(label)) return label.replace(/ies$/, "y");
  return label.replace(/s$/, "");
}

function formatValue(value: unknown, field: ResourceFieldConfig): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "select") {
    const match = field.options?.find((option) => option.value === value);
    return match?.label ?? String(value);
  }
  return String(value);
}

export interface ResourceViewPageProps<TUpdate extends FieldValues> {
  resource: string;
  title: string;
  fields: ResourceFieldConfig[];
  updateSchema: ZodType<TUpdate>;
  id: string;
}

export function ResourceViewPage<
  TRow extends { id: string; isActive?: boolean },
  TUpdate extends FieldValues,
>({ resource, title, fields, updateSchema, id }: ResourceViewPageProps<TUpdate>) {
  const [row, setRow] = useState<TRow | null | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const router = useRouter();
  const singular = singularize(title);

  useEffect(() => {
    fetch(`/api/${resource}/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setRow);
  }, [resource, id]);

  async function handleUpdate(values: TUpdate) {
    const res = await fetch(`/api/${resource}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    const updated = (await res.json()) as TRow;
    setRow(updated);
    setEditOpen(false);
    invalidate(resource);
    toast.success(`${singular} updated.`);
  }

  async function handleToggleActive() {
    if (!row) return;
    const activating = row.isActive === false;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    setToggling(true);
    try {
      const res = await fetch(`/api/${resource}/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      const updated = (await res.json()) as TRow;
      setRow(updated);
      invalidate(resource);
      toast.success(`${singular} ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete this ${singular.toLowerCase()}? It will be hidden everywhere in the system, including this list. This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/${resource}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate(resource);
      toast.success(`${singular} deleted.`);
      router.push(`/${resource}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-4 p-8">
      <Link href={`/${resource}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to {title}
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{singular} details</h1>
          {row && "isActive" in row && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                row.isActive === false
                  ? "bg-muted text-muted-foreground"
                  : "bg-success/15 text-success",
              )}
            >
              {row.isActive === false ? "Inactive" : "Active"}
            </span>
          )}
        </div>
        {row && (
          <div className="flex gap-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit {singular}</DialogTitle>
                </DialogHeader>
                <ResourceForm
                  schema={updateSchema}
                  fields={fields}
                  defaultValues={row as unknown as Partial<TUpdate>}
                  onSubmit={handleUpdate}
                  submitLabel="Save changes"
                />
              </DialogContent>
            </Dialog>
            {"isActive" in row && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={toggling}
                  onClick={handleToggleActive}
                >
                  {toggling && <Loader2Icon className="size-3.5 animate-spin" />}
                  {row.isActive === false ? "Activate" : "Deactivate"}
                </Button>
                <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
                  {deleting && <Loader2Icon className="size-3.5 animate-spin" />}
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className="bg-card flex flex-col gap-1 p-4 text-sm">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="font-medium break-words">
                {formatValue((row as Record<string, unknown>)[field.name], field)}
              </dd>
            </div>
          ))}
          {"isActive" in row && !fields.some((field) => field.name === "isActive") && (
            <div className="bg-card flex flex-col gap-1 p-4 text-sm">
              <dt className="text-muted-foreground">Active</dt>
              <dd className="font-medium">{row.isActive ? "Yes" : "No"}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
