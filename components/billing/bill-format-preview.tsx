"use client";

import type { Control, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useBillFormatPreview } from "@/lib/billing/useBillFormatPreview";

export function BillFormatPreview({ control }: { control: Control<FieldValues> }) {
  const formatKind = useWatch({ control, name: "formatKind" }) as string | undefined;
  const templateHtml = useWatch({ control, name: "templateHtml" }) as string | undefined;
  const { previewHtml, loading, runPreview } = useBillFormatPreview();

  return (
    <div className="space-y-2 sm:col-span-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void runPreview(formatKind ?? "", templateHtml ?? "")}
        disabled={loading}
      >
        {loading ? "Rendering…" : "Preview with sample data"}
      </Button>
      {previewHtml && (
        <iframe
          srcDoc={previewHtml}
          sandbox=""
          className="h-[28rem] w-full rounded-md border bg-white"
          title="Bill format preview"
        />
      )}
    </div>
  );
}
