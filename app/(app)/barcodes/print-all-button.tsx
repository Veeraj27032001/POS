"use client";

import { Button } from "@/components/ui/button";
import { getPrintBridge } from "@/lib/adapters/print";
import type { LabelPrintItem } from "@/lib/adapters/print";

export function PrintAllButton({ labels }: { labels: LabelPrintItem[] }) {
  return (
    <Button
      variant="outline"
      disabled={labels.length === 0}
      onClick={() => getPrintBridge().print({ kind: "label", labels })}
    >
      Print All ({labels.length})
    </Button>
  );
}
