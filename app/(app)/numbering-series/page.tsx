"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { StoreCardFilter } from "@/components/store-card-filter";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useInvalidateResource } from "@/lib/pagination/useList";

import { EditSeriesDialog } from "./edit-series-dialog";
import { NewSeriesDialog } from "./new-series-dialog";

interface SeriesRow {
  id: string;
  seriesType: string;
  prefix: string | null;
  currentNumber: number;
  isActive: boolean;
}

export default function NumberingSeriesPage() {
  const invalidate = useInvalidateResource();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  async function handleCopyToAllStores() {
    if (!selectedStoreId) return;
    if (
      !window.confirm(
        "Copy every numbering series from the selected store to all other stores that don't already have it?",
      )
    ) {
      return;
    }

    setCopying(true);
    try {
      const res = await fetch("/api/numbering-series/copy-to-all-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceStoreId: selectedStoreId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to copy series.");
        return;
      }
      invalidate("numbering-series");
      toast.success(`Copied ${body.copiedCount} series across ${body.targetStoreCount} store(s).`);
    } finally {
      setCopying(false);
    }
  }

  async function handleToggleActive(row: SeriesRow) {
    const activating = !row.isActive;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    setTogglingId(row.id);
    try {
      const res = await fetch(`/api/numbering-series/${row.id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      invalidate("numbering-series");
      toast.success(`Numbering series ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(row: SeriesRow) {
    if (
      !window.confirm(
        "Delete this numbering series? It will be hidden everywhere in the system, including this list. This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/numbering-series/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("numbering-series");
      toast.success("Numbering series deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Numbering Series</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-kbd-item=""
            disabled={!selectedStoreId || copying}
            onClick={handleCopyToAllStores}
          >
            {copying && <Loader2Icon className="size-3.5 animate-spin" />}
            Copy to All Stores
          </Button>
          {selectedStoreId && <NewSeriesDialog storeId={selectedStoreId} />}
        </div>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <DataTable<SeriesRow>
          resource="numbering-series"
          getRowId={(row) => row.id}
          filters={{ storeId: selectedStoreId }}
          columns={[
            { key: "seriesType", header: "Document type" },
            { key: "prefix", header: "Prefix", render: (row) => row.prefix ?? "—" },
            { key: "currentNumber", header: "Current number" },
            {
              key: "isActive",
              header: "Active",
              render: (row) => (row.isActive ? "Yes" : "No"),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <div className="flex gap-2">
                  <Link
                    href={`/numbering-series/${row.id}`}
                    data-kbd-item=""
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    View
                  </Link>
                  <EditSeriesDialog
                    id={row.id}
                    prefix={row.prefix}
                    currentNumber={row.currentNumber}
                    onSaved={() => invalidate("numbering-series")}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    data-kbd-item=""
                    disabled={togglingId === row.id}
                    onClick={() => handleToggleActive(row)}
                  >
                    {togglingId === row.id && <Loader2Icon className="size-3.5 animate-spin" />}
                    {row.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-kbd-item=""
                    disabled={deletingId === row.id}
                    onClick={() => handleDelete(row)}
                  >
                    {deletingId === row.id && <Loader2Icon className="size-3.5 animate-spin" />}
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
