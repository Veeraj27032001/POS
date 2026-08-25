"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { useInvalidateResource } from "@/lib/pagination/useList";

import { NewTaxCodeDialog } from "./new-tax-code-dialog";

interface TaxCodeRow {
  id: string;
  code: string;
  description: string;
  componentGroup: string;
  isActive: boolean;
}

export default function TaxSettingsPage() {
  const invalidate = useInvalidateResource();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleToggleActive(row: TaxCodeRow) {
    const activating = !row.isActive;
    if (!activating && !window.confirm("Deactivate this record?")) return;

    setTogglingId(row.id);
    try {
      const res = await fetch(`/api/tax-codes/${row.id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? `Failed to ${activating ? "activate" : "deactivate"}.`);
        return;
      }
      invalidate("tax-codes");
      toast.success(`Tax code ${activating ? "activated" : "deactivated"}.`);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(row: TaxCodeRow) {
    if (
      !window.confirm(
        "Delete this tax code? It will be hidden everywhere in the system, including this list. This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/tax-codes/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete.");
        return;
      }
      invalidate("tax-codes");
      toast.success("Tax code deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tax Codes</h1>
        <NewTaxCodeDialog />
      </div>

      <DataTable<TaxCodeRow>
        resource="tax-codes"
        searchable
        getRowId={(row) => row.id}
        columns={[
          { key: "code", header: "Code" },
          { key: "description", header: "Description" },
          { key: "componentGroup", header: "Component group" },
          { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/settings/tax/${row.id}`}>View</Link>}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={togglingId === row.id}
                  onClick={() => handleToggleActive(row)}
                >
                  {togglingId === row.id && <Loader2Icon className="size-3.5 animate-spin" />}
                  {row.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
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
    </div>
  );
}
