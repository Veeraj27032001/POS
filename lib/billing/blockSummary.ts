import type { DesignBlock } from "@/lib/billing/billFormatDesign.types";

export function summarizeBlock(block: DesignBlock): string {
  switch (block.type) {
    case "header":
      return "Store name, address, GSTIN";
    case "logo":
      return `Logo, max ${block.config.maxHeightPx}px`;
    case "title_text":
      return block.config.text || "(empty)";
    case "meta_grid":
      return `${block.config.rows.length} field${block.config.rows.length === 1 ? "" : "s"}, ${block.config.columns} column${block.config.columns === 1 ? "" : "s"}`;
    case "item_table":
      return `${block.config.columns.length} column${block.config.columns.length === 1 ? "" : "s"}`;
    case "totals_block":
      return `${block.config.rows.length} row${block.config.rows.length === 1 ? "" : "s"}`;
    case "free_text":
      return block.config.content ? block.config.content.slice(0, 40) : "(empty)";
    case "divider":
      return block.config.kind === "line" ? "Line" : "Spacer";
    case "signature":
      return block.config.label;
    default:
      return "";
  }
}
