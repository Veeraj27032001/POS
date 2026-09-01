import type {
  BillFormatDesign,
  BlockStyle,
  DesignBlock,
} from "@/lib/billing/billFormatDesign.types";

const BASE_STYLE = `
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 32px; }
  table { border-collapse: collapse; width: 100%; }
  .block { margin: 4px 0; }
  .header-block h1 { margin: 0 0 4px; font-size: 22px; }
  .header-block p { margin: 2px 0; }
  .logo-block img { display: inline-block; }
  .title-block { font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  table.meta-grid-block td { padding: 4px 8px; font-size: 11.5px; vertical-align: top; }
  table.item-table-block th, table.item-table-block td { padding: 6px 8px; border: 1px solid #ccc; font-size: 11.5px; }
  table.item-table-block th { background: #f4f2ef; text-align: left; }
  table.totals-block { width: 45%; margin-left: auto; }
  table.totals-block td { padding: 4px 6px; font-size: 11.5px; }
  tr.grand td { font-weight: 700; font-size: 14px; border-top: 2px solid #1e3a8a; padding-top: 8px; }
  .free-text-block { font-size: 11.5px; }
  .signature-block { margin-top: 40px; }
  .sig-space { height: 40px; }
  .footer-note { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9.5px; color: #888; text-align: center; }
`;

const FONT_SIZE_PX: Record<NonNullable<BlockStyle["fontSize"]>, number> = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
};
const COLOR_HEX: Record<NonNullable<BlockStyle["color"]>, string> = {
  default: "#1a1a1a",
  muted: "#6b6474",
  accent: "#1e3a8a",
};
const SPACING_PX: Record<NonNullable<BlockStyle["marginTop"]>, number> = {
  none: 0,
  sm: 8,
  md: 16,
  lg: 32,
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleAttr(style?: BlockStyle): string {
  if (!style) return "";
  const decls: string[] = [];
  if (style.align) decls.push(`text-align:${style.align}`);
  if (style.fontSize) decls.push(`font-size:${FONT_SIZE_PX[style.fontSize]}px`);
  if (style.color) decls.push(`color:${COLOR_HEX[style.color]}`);
  if (style.marginTop) decls.push(`margin-top:${SPACING_PX[style.marginTop]}px`);
  if (style.marginBottom) decls.push(`margin-bottom:${SPACING_PX[style.marginBottom]}px`);
  return decls.length > 0 ? ` style="${decls.join(";")}"` : "";
}

function wrapIf(condition: boolean, field: string, html: string): string {
  return condition ? `{{#if ${field}}}${html}{{/if}}` : html;
}

function renderFreeTextContent(content: string): string {
  const parts = content.split(/(\{\{[^}]+\}\})/g);
  return parts
    .map((part) =>
      part.startsWith("{{") && part.endsWith("}}") ? part : escapeHtml(part).replace(/\n/g, "<br>"),
    )
    .join("");
}

function renderBlock(block: DesignBlock): string {
  switch (block.type) {
    case "header": {
      const { showStoreName, showAddress, showGstin, showStateLine } = block.config;
      const lines: string[] = [];
      if (showStoreName) lines.push("<h1>{{storeName}}</h1>");
      if (showAddress) lines.push(wrapIf(true, "storeAddress", "<p>{{storeAddress}}</p>"));
      if (showGstin) lines.push(wrapIf(true, "storeGstin", "<p>GSTIN: {{storeGstin}}</p>"));
      if (showStateLine) {
        lines.push(
          wrapIf(
            true,
            "storeStateName",
            "<p>State: {{storeStateName}}{{#if storeStateCode}} ({{storeStateCode}}){{/if}}</p>",
          ),
        );
      }
      return `<div class="block header-block"${styleAttr(block.style)}>${lines.join("\n")}</div>`;
    }
    case "logo": {
      const { align, maxHeightPx } = block.config;
      const img = `{{#if storeLogoUrl}}<img src="{{storeLogoUrl}}" style="max-height:${maxHeightPx}px" />{{/if}}`;
      return `<div class="block logo-block" style="text-align:${align}"${styleAttr(block.style)}>${img}</div>`;
    }
    case "title_text":
      return `<div class="block title-block"${styleAttr(block.style)}>${escapeHtml(block.config.text)}</div>`;
    case "meta_grid": {
      const { columns, rows } = block.config;
      const cells = rows.map((row) => {
        const cell = `<td><strong>${escapeHtml(row.label)}:</strong> {{${row.field}}}</td>`;
        return wrapIf(row.visibleIf === "field-truthy", row.field, cell);
      });
      const trs: string[] = [];
      for (let i = 0; i < cells.length; i += columns) {
        trs.push(`<tr>${cells.slice(i, i + columns).join("")}</tr>`);
      }
      return `<table class="block meta-grid-block"${styleAttr(block.style)}>${trs.join("\n")}</table>`;
    }
    case "item_table": {
      const { columns } = block.config;
      const thead = columns
        .map((col) => `<th style="text-align:${col.align}">${escapeHtml(col.headerLabel)}</th>`)
        .join("");
      const tds = columns
        .map((col) => {
          const expr =
            col.format === "money"
              ? `{{money ${col.field}}}`
              : col.format === "index"
                ? "{{index1 @index}}"
                : `{{${col.field}}}`;
          return `<td style="text-align:${col.align}">${expr}</td>`;
        })
        .join("");
      return `<table class="block item-table-block"${styleAttr(block.style)}>
  <thead><tr>${thead}</tr></thead>
  <tbody>{{#each lines}}<tr>${tds}</tr>{{/each}}</tbody>
</table>`;
    }
    case "totals_block": {
      const { rows } = block.config;
      const trs = rows.map((row) => {
        const tr = `<tr${row.emphasis ? ' class="grand"' : ""}><td>${escapeHtml(row.label)}</td><td class="num" style="text-align:right">{{money ${row.field}}}</td></tr>`;
        return wrapIf(row.visibleIf === "field-truthy", row.field, tr);
      });
      return `<table class="block totals-block"${styleAttr(block.style)}>${trs.join("\n")}</table>`;
    }
    case "free_text":
      return `<div class="block free-text-block"${styleAttr(block.style)}>${renderFreeTextContent(block.config.content)}</div>`;
    case "divider":
      return block.config.kind === "line"
        ? `<hr style="margin:${block.config.heightPx ?? 10}px 0" />`
        : `<div style="height:${block.config.heightPx ?? 20}px"></div>`;
    case "signature": {
      const { label, showForStoreLine, align } = block.config;
      const storeLine = showForStoreLine ? "<div>For {{storeName}}</div>" : "";
      return `<div class="block signature-block" style="text-align:${align}"${styleAttr(block.style)}>
  ${storeLine}
  <div class="sig-space"></div>
  <div>${escapeHtml(label)}</div>
</div>`;
    }
    default:
      return "";
  }
}

export function compileBillFormatDesign(design: BillFormatDesign): string {
  const bodyHtml = design.blocks.map(renderBlock).join("\n");
  return `<!doctype html>
<html>
<head>
<style>
${BASE_STYLE}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
