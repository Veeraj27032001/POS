import { z } from "zod";

export const blockStyleSchema = z.object({
  align: z.enum(["left", "center", "right"]).optional(),
  fontSize: z.enum(["sm", "md", "lg", "xl"]).optional(),
  color: z.enum(["default", "muted", "accent"]).optional(),
  marginTop: z.enum(["none", "sm", "md", "lg"]).optional(),
  marginBottom: z.enum(["none", "sm", "md", "lg"]).optional(),
});
export type BlockStyle = z.infer<typeof blockStyleSchema>;

const visibleIfSchema = z.enum(["always", "field-truthy"]);

export const headerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("header"),
  config: z.object({
    showStoreName: z.boolean().default(true),
    showAddress: z.boolean().default(true),
    showGstin: z.boolean().default(true),
    showStateLine: z.boolean().default(true),
  }),
  style: blockStyleSchema,
});

export const logoBlockSchema = z.object({
  id: z.string(),
  type: z.literal("logo"),
  config: z.object({
    align: z.enum(["left", "center", "right"]).default("center"),
    maxHeightPx: z.number().int().positive().max(400).default(80),
  }),
  style: blockStyleSchema,
});

export const titleTextBlockSchema = z.object({
  id: z.string(),
  type: z.literal("title_text"),
  config: z.object({
    text: z.string().min(1),
  }),
  style: blockStyleSchema,
});

const metaGridRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  field: z.string(),
  visibleIf: visibleIfSchema.default("always"),
});
export const metaGridBlockSchema = z.object({
  id: z.string(),
  type: z.literal("meta_grid"),
  config: z.object({
    columns: z.union([z.literal(1), z.literal(2)]).default(2),
    rows: z.array(metaGridRowSchema),
  }),
  style: blockStyleSchema,
});

const itemTableColumnSchema = z.object({
  id: z.string(),
  field: z.string(),
  headerLabel: z.string(),
  align: z.enum(["left", "center", "right"]).default("left"),
  format: z.enum(["text", "number", "money", "index"]).default("text"),
});
export const itemTableBlockSchema = z.object({
  id: z.string(),
  type: z.literal("item_table"),
  config: z.object({
    columns: z.array(itemTableColumnSchema),
  }),
  style: blockStyleSchema,
});

const totalsRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  field: z.string(),
  visibleIf: visibleIfSchema.default("always"),
  emphasis: z.boolean().default(false),
});
export const totalsBlockSchema = z.object({
  id: z.string(),
  type: z.literal("totals_block"),
  config: z.object({
    rows: z.array(totalsRowSchema),
  }),
  style: blockStyleSchema,
});

export const freeTextBlockSchema = z.object({
  id: z.string(),
  type: z.literal("free_text"),
  config: z.object({
    content: z.string(),
  }),
  style: blockStyleSchema,
});

export const dividerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("divider"),
  config: z.object({
    kind: z.enum(["line", "space"]).default("line"),
    heightPx: z.number().int().positive().max(200).optional(),
  }),
});

export const signatureBlockSchema = z.object({
  id: z.string(),
  type: z.literal("signature"),
  config: z.object({
    label: z.string().min(1),
    showForStoreLine: z.boolean().default(true),
    align: z.enum(["left", "right"]).default("right"),
  }),
  style: blockStyleSchema,
});

export const designBlockSchema = z.discriminatedUnion("type", [
  headerBlockSchema,
  logoBlockSchema,
  titleTextBlockSchema,
  metaGridBlockSchema,
  itemTableBlockSchema,
  totalsBlockSchema,
  freeTextBlockSchema,
  dividerBlockSchema,
  signatureBlockSchema,
]);
export type DesignBlock = z.infer<typeof designBlockSchema>;
export type DesignBlockType = DesignBlock["type"];

export const billFormatDesignSchema = z.object({
  version: z.literal(1),
  formatKind: z.enum(["receipt", "bill", "credit_note", "refund"]),
  blocks: z.array(designBlockSchema),
});
export type BillFormatDesign = z.infer<typeof billFormatDesignSchema>;

export const BLOCK_TYPE_LABELS: Record<DesignBlockType, string> = {
  header: "Store Header",
  logo: "Logo",
  title_text: "Title Text",
  meta_grid: "Info Grid",
  item_table: "Item Table",
  totals_block: "Totals",
  free_text: "Free Text",
  divider: "Divider",
  signature: "Signature",
};
