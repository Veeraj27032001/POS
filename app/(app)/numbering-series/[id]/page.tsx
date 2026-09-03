"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useInvalidateResource } from "@/lib/pagination/useList";
import { cn } from "@/lib/utils";

import { EditSeriesDialog } from "../edit-series-dialog";

interface SeriesRow {
  id: string;
  seriesType: string;
  storeId: string;
  financialYearId: string;
  prefix: string | null;
  currentNumber: number;
  isActive: boolean;
}

function lookupLabel(options: { value: string; label: string }[], id: string | null) {
  if (!id) return "—";
  return options.find((option) => option.value === id)?.label ?? id;
}

export default function SeriesViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<SeriesRow | null | undefined>(undefined);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const invalidate = useInvalidateResource();
  const financialYears = useOptionsList("financial-years-admin", "label");
  const stores = useOptionsList("stores/options", "name");

  function refresh() {
    fetch(`/api/numbering-series/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setRow);
  }

  useEffect(refresh, [id]);

  async function handleToggleActive() {
    if (!row) return;
    const activating = !row.isActive;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    setToggling(true);
    try {
      const res = await fetch(`/api/numbering-series/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      const updated = (await res.json()) as SeriesRow;
      setRow(updated);
      invalidate("numbering-series");
      toast.success(`Numbering series ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this numbering series? It will be hidden everywhere in the system, including this list. This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/numbering-series/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("numbering-series");
      toast.success("Numbering series deleted.");
      router.push("/numbering-series");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <Link href="/numbering-series" className="text-muted-foreground text-sm hover:underline">
        ← Back to Numbering Series
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Numbering series details</h1>
          {row && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                row.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {row.isActive ? "Active" : "Inactive"}
            </span>
          )}
        </div>
        {row && (
          <div className="flex flex-wrap gap-2">
            <EditSeriesDialog
              id={id}
              prefix={row.prefix}
              currentNumber={row.currentNumber}
              onSaved={refresh}
            />
            <Button variant="outline" size="sm" disabled={toggling} onClick={handleToggleActive}>
              {toggling && <Loader2Icon className="size-3.5 animate-spin" />}
              {row.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2Icon className="size-3.5 animate-spin" />}
              Delete
            </Button>
          </div>
        )}
      </div>

      {row === undefined && <p className="text-muted-foreground">Loading…</p>}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
          {[
            ["Document type", row.seriesType],
            ["Store", lookupLabel(stores, row.storeId)],
            ["Financial year", lookupLabel(financialYears, row.financialYearId)],
            ["Prefix", row.prefix ?? "—"],
            ["Current number", String(row.currentNumber)],
          ].map(([label, value]) => (
            <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
