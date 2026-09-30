"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Control, FieldValues } from "react-hook-form";
import { toast } from "sonner";
import type { ZodType } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn } from "@/components/data-table/types";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useInvalidateResource } from "@/lib/pagination/useList";

import { ResourceForm } from "./resource-form";
import type { ResourceFieldConfig } from "./types";

function singularize(label: string): string {
  // "Units of Measure" pluralises the head noun, not the tail.
  const ofIndex = label.indexOf(" of ");
  if (ofIndex > 0) return singularize(label.slice(0, ofIndex)) + label.slice(ofIndex);
  if (/ies$/.test(label)) return label.replace(/ies$/, "y");
  return label.replace(/s$/, "");
}

export interface ResourcePageProps<
  TRow extends { id: string; isActive?: boolean },
  TCreate extends FieldValues,
  TUpdate extends FieldValues,
> {
  resource: string;
  title: string;
  columns: DataTableColumn<TRow>[];
  fields: ResourceFieldConfig[];
  createSchema: ZodType<TCreate>;
  updateSchema: ZodType<TUpdate>;
  getRowId: (row: TRow) => string;
  searchable?: boolean;
  /** Extra server-side filters (column: value) merged into the list query. */
  filters?: Record<string, string>;
  /** Pre-filled values for the New dialog, e.g. the currently store-filtered view's store. */
  createDefaultValues?: Partial<TCreate>;
  /** Extra actions rendered next to the New button, e.g. an Import trigger. */
  headerExtra?: ReactNode;
  /** Extra UI rendered inside the create/edit form, with access to live
   * form values (e.g. a preview button). */
  renderFormExtra?: (control: Control<FieldValues>) => ReactNode;
  /** Widens the create/edit dialog beyond the default sm:max-w-lg. */
  dialogClassName?: string;
  /** Extra action(s) appended to each row's actions cell, e.g. a link to a bespoke sub-page. */
  rowActions?: (row: TRow) => ReactNode;
}

export function ResourcePage<
  TRow extends { id: string; isActive?: boolean },
  TCreate extends FieldValues,
  TUpdate extends FieldValues,
>({
  resource,
  title,
  columns,
  fields,
  createSchema,
  updateSchema,
  getRowId,
  searchable = true,
  filters,
  createDefaultValues,
  headerExtra,
  renderFormExtra,
  dialogClassName,
  rowActions,
}: ResourcePageProps<TRow, TCreate, TUpdate>) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const invalidate = useInvalidateResource();
  const singular = singularize(title);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function handleCreate(values: TCreate) {
    const res = await fetch(`/api/${resource}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    setCreateOpen(false);
    invalidate(resource);
    toast.success(`${singular} created.`);
  }

  async function handleUpdate(values: TUpdate) {
    if (!editingRow) return;
    const res = await fetch(`/api/${resource}/${getRowId(editingRow)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to save.");
      return;
    }
    setEditingRow(null);
    invalidate(resource);
    toast.success(`${singular} updated.`);
  }

  async function handleToggleActive(row: TRow) {
    const activating = row.isActive === false;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    const id = getRowId(row);
    setTogglingId(id);
    try {
      const res = await fetch(`/api/${resource}/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      invalidate(resource);
      toast.success(`${singular} ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(row: TRow) {
    if (
      !window.confirm(
        `Delete this ${singular.toLowerCase()}? It will be hidden everywhere in the system, including this list. This cannot be undone.`,
      )
    ) {
      return;
    }

    const id = getRowId(row);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/${resource}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate(resource);
      toast.success(`${singular} deleted.`);
    } finally {
      setDeletingId(null);
    }
  }

  const columnsWithActions: DataTableColumn<TRow>[] = [
    ...columns,
    {
      key: "__actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <Link
            href={`/${resource}/${getRowId(row)}`}
            data-kbd-item=""
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View
          </Link>
          <Button variant="outline" size="sm" data-kbd-item="" onClick={() => setEditingRow(row)}>
            Edit
          </Button>
          {rowActions?.(row)}
          {"isActive" in row && (
            <>
              <Button
                variant="outline"
                size="sm"
                data-kbd-item=""
                disabled={togglingId === getRowId(row)}
                onClick={() => handleToggleActive(row)}
              >
                {togglingId === getRowId(row) && <Loader2Icon className="size-3.5 animate-spin" />}
                {row.isActive === false ? "Activate" : "Deactivate"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                data-kbd-item=""
                disabled={deletingId === getRowId(row)}
                onClick={() => handleDelete(row)}
              >
                {deletingId === getRowId(row) && <Loader2Icon className="size-3.5 animate-spin" />}
                Delete
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          {headerExtra}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button data-kbd-item="">New {singular}</Button>} />
            <DialogContent className={dialogClassName}>
              <DialogHeader>
                <DialogTitle>New {singular}</DialogTitle>
              </DialogHeader>
              <ResourceForm
                schema={createSchema}
                fields={fields}
                defaultValues={createDefaultValues}
                onSubmit={handleCreate}
                renderExtra={renderFormExtra}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DataTable<TRow>
        resource={resource}
        columns={columnsWithActions}
        getRowId={getRowId}
        searchable={searchable}
        filters={filters}
      />

      <Dialog
        open={editingRow !== null}
        onOpenChange={(next) => {
          if (!next) setEditingRow(null);
        }}
      >
        <DialogContent className={dialogClassName}>
          <DialogHeader>
            <DialogTitle>Edit {singular}</DialogTitle>
          </DialogHeader>
          {editingRow && (
            <ResourceForm
              schema={updateSchema}
              requiredFieldsSchema={createSchema}
              fields={fields}
              defaultValues={editingRow as unknown as Partial<TUpdate>}
              onSubmit={handleUpdate}
              submitLabel="Save changes"
              renderExtra={renderFormExtra}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
