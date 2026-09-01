import type { BillFormatKind } from "@/generated/prisma/client";
import type { DesignBlock, DesignBlockType } from "@/lib/billing/billFormatDesign.types";
import {
  getLineFields,
  getScalarFields,
  getSummaryFields,
} from "@/lib/billing/billFormatMergeFields";

export function createDefaultBlock(type: DesignBlockType, formatKind: BillFormatKind): DesignBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "header":
      return {
        id,
        type,
        config: { showStoreName: true, showAddress: true, showGstin: true, showStateLine: false },
        style: {},
      };
    case "logo":
      return { id, type, config: { align: "center", maxHeightPx: 80 }, style: {} };
    case "title_text":
      return { id, type, config: { text: "Document Title" }, style: { align: "center" } };
    case "meta_grid": {
      const scalar = getScalarFields(formatKind);
      return {
        id,
        type,
        config: {
          columns: 2,
          rows: scalar.slice(0, 2).map((f) => ({
            id: crypto.randomUUID(),
            label: f.label,
            field: f.field,
            visibleIf: "always" as const,
          })),
        },
        style: {},
      };
    }
    case "item_table": {
      const lineFields = getLineFields(formatKind);
      return {
        id,
        type,
        config: {
          columns: lineFields.slice(0, 3).map((f) => ({
            id: crypto.randomUUID(),
            field: f.field,
            headerLabel: f.label,
            align: "left" as const,
            format: "text" as const,
          })),
        },
        style: {},
      };
    }
    case "totals_block": {
      const summary = getSummaryFields(formatKind);
      return {
        id,
        type,
        config: {
          rows: summary.slice(0, 1).map((f) => ({
            id: crypto.randomUUID(),
            label: f.label,
            field: f.field,
            visibleIf: "always" as const,
            emphasis: true,
          })),
        },
        style: {},
      };
    }
    case "free_text":
      return { id, type, config: { content: "" }, style: {} };
    case "divider":
      return { id, type, config: { kind: "line" } };
    case "signature":
      return {
        id,
        type,
        config: { label: "Authorised Signature", showForStoreLine: true, align: "right" },
        style: {},
      };
  }
}
