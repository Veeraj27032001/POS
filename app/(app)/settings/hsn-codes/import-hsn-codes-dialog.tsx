"use client";

import Papa from "papaparse";
import { useRef, useState } from "react";
import { toast } from "sonner";

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
import { useInvalidateResource } from "@/lib/pagination/useList";

interface HsnCodeCsvRow {
  id: string;
  hsnCode: string;
  description: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
}

const CSV_COLUMNS = ["id", "hsnCode", "description", "cgstRate", "sgstRate", "igstRate"] as const;

export function ImportHsnCodesDialog() {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidateResource();

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const res = await fetch("/api/hsn-codes?pageSize=1000");
      if (!res.ok) {
        toast.error("Failed to load HSN codes for the template.");
        return;
      }
      const body = (await res.json()) as { data: HsnCodeCsvRow[] };
      const csv = Papa.unparse({
        fields: [...CSV_COLUMNS],
        data: body.data.map((row) => CSV_COLUMNS.map((col) => row[col])),
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hsn-codes-template.csv";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length > 0) {
        toast.error("Couldn't read that CSV file.");
        return;
      }

      const rows = parsed.data
        .filter((row) => row.hsnCode?.trim())
        .map((row) => ({
          id: row.id?.trim() ? row.id.trim() : undefined,
          hsnCode: row.hsnCode.trim(),
          description: row.description?.trim() ?? "",
          cgstRate: Number(row.cgstRate) || 0,
          sgstRate: Number(row.sgstRate) || 0,
          igstRate: Number(row.igstRate) || 0,
        }));

      if (rows.length === 0) {
        toast.error("The file has no rows to import.");
        return;
      }

      const res = await fetch("/api/hsn-codes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const resultBody = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(resultBody?.error?.message ?? "Import failed.");
        return;
      }

      invalidate("hsn-codes");
      const { created, updated, errors } = resultBody as {
        created: number;
        updated: number;
        errors: string[];
      };
      if (errors.length > 0) {
        toast.error(`Imported with ${errors.length} error(s): ${errors[0]}`);
      } else {
        toast.success(`Imported: ${created} created, ${updated} updated.`);
      }
      setOpen(false);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Import</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import HSN Codes</DialogTitle>
        </DialogHeader>
        <DialogFormBody>
          <p className="text-muted-foreground text-sm">
            Download the current HSN codes as a CSV template, edit rates or add new rows in a
            spreadsheet, then import the file back. Rows with an existing id are updated in place;
            rows without one are created.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={downloading}
            onClick={handleDownloadTemplate}
          >
            {downloading ? "Preparing…" : "Download Template"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelected}
          />
        </DialogFormBody>
        <DialogFormActions>
          <Button type="button" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? "Importing…" : "Import CSV"}
          </Button>
        </DialogFormActions>
      </DialogContent>
    </Dialog>
  );
}
