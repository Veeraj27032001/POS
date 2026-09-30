"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatTimestamp } from "@/lib/datetime/format";
import {
  SOURCE_TYPE_CONFIG,
  type SourceItemType,
} from "@/lib/documents/entryCorrectionSourceTypes";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface EntryCorrectionRow {
  id: string;
  documentNumber: string;
  sourceItemType: SourceItemType;
  fieldCorrected: string;
  previousValue: number;
  newValue: number;
  correctedAt: string;
}

export default function EntryCorrectionsPage() {
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entry Correction</h1>
        <Link href="/entry-corrections/new" data-kbd-item="" className={buttonVariants()}>
          New Correction
        </Link>
      </div>

      <DataTable<EntryCorrectionRow>
        resource="entry-corrections"
        getRowId={(row) => row.id}
        columns={[
          { key: "documentNumber", header: "Correction No." },
          {
            key: "sourceItemType",
            header: "Source document",
            render: (row) => SOURCE_TYPE_CONFIG[row.sourceItemType].label,
          },
          {
            key: "change",
            header: "Change",
            render: (row) => `${row.previousValue} → ${row.newValue}`,
          },
          {
            key: "correctedAt",
            header: "Corrected at",
            render: (row) => formatTimestamp(row.correctedAt),
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Link
                href={`/entry-corrections/${row.id}`}
                data-kbd-item=""
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
