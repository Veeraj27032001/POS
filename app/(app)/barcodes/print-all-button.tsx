"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getPrintBridge } from "@/lib/adapters/print";
import type { LabelPrintItem } from "@/lib/adapters/print";

export function PrintAllButton({
  totalCount,
  fetchLabels,
}: {
  totalCount: number;
  fetchLabels: () => Promise<LabelPrintItem[]>;
}) {
  const [printing, setPrinting] = useState(false);

  async function handleClick() {
    setPrinting(true);
    try {
      const labels = await fetchLabels();
      await getPrintBridge().print({ kind: "label", labels });
    } catch {
      toast.error("Failed to print labels.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Button
      variant="outline"
      disabled={totalCount === 0 || printing}
      onClick={() => void handleClick()}
    >
      {printing ? "Preparing…" : `Print All (${totalCount})`}
    </Button>
  );
}
