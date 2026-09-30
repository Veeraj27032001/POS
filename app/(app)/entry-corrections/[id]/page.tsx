"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatTimestamp } from "@/lib/datetime/format";
import {
  SOURCE_TYPE_CONFIG,
  type SourceItemType,
} from "@/lib/documents/entryCorrectionSourceTypes";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { LoadingState } from "@/components/loading-state";

interface EntryCorrectionRow {
  id: string;
  documentNumber: string;
  sourceItemType: SourceItemType;
  sourceItemId: string;
  fieldCorrected: string;
  previousValue: number;
  newValue: number;
  notes: string | null;
  correctedAt: string;
}

export default function EntryCorrectionViewPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<EntryCorrectionRow | null | undefined>(undefined);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/entry-corrections/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setRow(body));
  }, [id]);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href="/entry-corrections"
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to Entry Correction
      </Link>

      {row === undefined && <LoadingState />}
      {row === null && <p className="text-muted-foreground">Record not found.</p>}

      {row && (
        <>
          <h1 className="text-2xl font-semibold">{row.documentNumber}</h1>
          <p className="text-muted-foreground text-sm">
            This correction was applied to the source document and logged here for audit.
          </p>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Source document", SOURCE_TYPE_CONFIG[row.sourceItemType].label],
              ["Field corrected", SOURCE_TYPE_CONFIG[row.sourceItemType].fieldLabel],
              ["Previous value", String(row.previousValue)],
              ["New value", String(row.newValue)],
              ["Corrected at", formatTimestamp(row.correctedAt)],
              ["Notes", row.notes ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
