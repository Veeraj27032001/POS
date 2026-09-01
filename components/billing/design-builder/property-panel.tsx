"use client";

import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BillFormatKind } from "@/generated/prisma/client";
import type { BlockStyle, DesignBlock } from "@/lib/billing/billFormatDesign.types";
import {
  getLineFields,
  getScalarFields,
  getSummaryFields,
  type MergeFieldOption,
} from "@/lib/billing/billFormatMergeFields";

type Updater = (updater: (block: DesignBlock) => DesignBlock) => void;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PlainSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} items={options}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StylePanel({
  style,
  onChange,
}: {
  style: BlockStyle;
  onChange: (style: BlockStyle) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-t pt-3">
      <Field label="Align">
        <PlainSelect
          value={style.align ?? "left"}
          onChange={(v) => onChange({ ...style, align: v as BlockStyle["align"] })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </Field>
      <Field label="Font size">
        <PlainSelect
          value={style.fontSize ?? "md"}
          onChange={(v) => onChange({ ...style, fontSize: v as BlockStyle["fontSize"] })}
          options={[
            { value: "sm", label: "Small" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Large" },
            { value: "xl", label: "Extra large" },
          ]}
        />
      </Field>
      <Field label="Color">
        <PlainSelect
          value={style.color ?? "default"}
          onChange={(v) => onChange({ ...style, color: v as BlockStyle["color"] })}
          options={[
            { value: "default", label: "Default" },
            { value: "muted", label: "Muted" },
            { value: "accent", label: "Accent" },
          ]}
        />
      </Field>
      <Field label="Spacing above">
        <PlainSelect
          value={style.marginTop ?? "none"}
          onChange={(v) => onChange({ ...style, marginTop: v as BlockStyle["marginTop"] })}
          options={[
            { value: "none", label: "None" },
            { value: "sm", label: "Small" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Large" },
          ]}
        />
      </Field>
      <Field label="Spacing below">
        <PlainSelect
          value={style.marginBottom ?? "none"}
          onChange={(v) => onChange({ ...style, marginBottom: v as BlockStyle["marginBottom"] })}
          options={[
            { value: "none", label: "None" },
            { value: "sm", label: "Small" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Large" },
          ]}
        />
      </Field>
    </div>
  );
}

function ReorderButtons({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex flex-col">
      <Button type="button" variant="ghost" size="icon-xs" onClick={onUp}>
        <ChevronUpIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onDown}>
        <ChevronDownIcon />
      </Button>
    </div>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function PropertyPanel({
  block,
  formatKind,
  onChange,
}: {
  block: DesignBlock;
  formatKind: BillFormatKind;
  onChange: Updater;
}) {
  const scalarFields = getScalarFields(formatKind);
  const lineFields = getLineFields(formatKind);
  const summaryFields = getSummaryFields(formatKind);

  function updateStyle(style: BlockStyle) {
    onChange((b) => ({ ...b, style }) as DesignBlock);
  }

  if (block.type === "header") {
    const { config } = block;
    return (
      <div className="space-y-3">
        {(
          [
            ["showStoreName", "Show store name"],
            ["showAddress", "Show address"],
            ["showGstin", "Show GSTIN"],
            ["showStateLine", "Show state line"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={key}
              checked={config[key]}
              onCheckedChange={(checked) =>
                onChange(
                  (b) =>
                    ({
                      ...b,
                      config: { ...(b as typeof block).config, [key]: Boolean(checked) },
                    }) as DesignBlock,
                )
              }
            />
            <Label htmlFor={key}>{label}</Label>
          </div>
        ))}
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "logo") {
    const { config } = block;
    return (
      <div className="space-y-3">
        <Field label="Align">
          <PlainSelect
            value={config.align}
            onChange={(v) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: {
                      ...(b as typeof block).config,
                      align: v as "left" | "center" | "right",
                    },
                  }) as DesignBlock,
              )
            }
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
        <Field label="Max height (px)">
          <Input
            type="number"
            min={20}
            max={400}
            value={config.maxHeightPx}
            onChange={(e) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: {
                      ...(b as typeof block).config,
                      maxHeightPx: Number(e.target.value) || 80,
                    },
                  }) as DesignBlock,
              )
            }
          />
        </Field>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "title_text") {
    return (
      <div className="space-y-3">
        <Field label="Text">
          <Input
            value={block.config.text}
            onChange={(e) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, text: e.target.value },
                  }) as DesignBlock,
              )
            }
          />
        </Field>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "meta_grid") {
    const { rows, columns } = block.config;
    function updateRows(next: typeof rows) {
      onChange(
        (b) => ({ ...b, config: { ...(b as typeof block).config, rows: next } }) as DesignBlock,
      );
    }
    return (
      <div className="space-y-3">
        <Field label="Columns">
          <PlainSelect
            value={String(columns)}
            onChange={(v) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, columns: Number(v) as 1 | 2 },
                  }) as DesignBlock,
              )
            }
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
            ]}
          />
        </Field>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.id} className="space-y-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1">
                <Input
                  value={row.label}
                  onChange={(e) =>
                    updateRows(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                  }
                  placeholder="Label"
                  className="flex-1"
                />
                <ReorderButtons
                  onUp={() => updateRows(move(rows, i, i - 1))}
                  onDown={() => updateRows(move(rows, i, i + 1))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => updateRows(rows.filter((_, j) => j !== i))}
                >
                  <TrashIcon />
                </Button>
              </div>
              <FieldSelect
                options={scalarFields}
                value={row.field}
                onChange={(field) =>
                  updateRows(rows.map((r, j) => (j === i ? { ...r, field } : r)))
                }
              />
              <PlainSelect
                value={row.visibleIf}
                onChange={(v) =>
                  updateRows(
                    rows.map((r, j) =>
                      j === i ? { ...r, visibleIf: v as "always" | "field-truthy" } : r,
                    ),
                  )
                }
                options={[
                  { value: "always", label: "Always show" },
                  { value: "field-truthy", label: "Only if it has a value" },
                ]}
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updateRows([
              ...rows,
              {
                id: crypto.randomUUID(),
                label: scalarFields[0]?.label ?? "Field",
                field: scalarFields[0]?.field ?? "",
                visibleIf: "always",
              },
            ])
          }
        >
          <PlusIcon /> Add row
        </Button>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "item_table") {
    const { columns } = block.config;
    function updateColumns(next: typeof columns) {
      onChange(
        (b) => ({ ...b, config: { ...(b as typeof block).config, columns: next } }) as DesignBlock,
      );
    }
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {columns.map((col, i) => (
            <div key={col.id} className="space-y-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1">
                <Input
                  value={col.headerLabel}
                  onChange={(e) =>
                    updateColumns(
                      columns.map((c, j) => (j === i ? { ...c, headerLabel: e.target.value } : c)),
                    )
                  }
                  placeholder="Header label"
                  className="flex-1"
                />
                <ReorderButtons
                  onUp={() => updateColumns(move(columns, i, i - 1))}
                  onDown={() => updateColumns(move(columns, i, i + 1))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => updateColumns(columns.filter((_, j) => j !== i))}
                >
                  <TrashIcon />
                </Button>
              </div>
              <FieldSelect
                options={lineFields}
                value={col.field}
                onChange={(field) =>
                  updateColumns(columns.map((c, j) => (j === i ? { ...c, field } : c)))
                }
              />
              <div className="grid grid-cols-2 gap-1.5">
                <PlainSelect
                  value={col.align}
                  onChange={(v) =>
                    updateColumns(
                      columns.map((c, j) =>
                        j === i ? { ...c, align: v as "left" | "center" | "right" } : c,
                      ),
                    )
                  }
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" },
                  ]}
                />
                <PlainSelect
                  value={col.format}
                  onChange={(v) =>
                    updateColumns(
                      columns.map((c, j) =>
                        j === i ? { ...c, format: v as "text" | "number" | "money" | "index" } : c,
                      ),
                    )
                  }
                  options={[
                    { value: "text", label: "Text" },
                    { value: "number", label: "Number" },
                    { value: "money", label: "Money" },
                    { value: "index", label: "Row number" },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updateColumns([
              ...columns,
              {
                id: crypto.randomUUID(),
                field: lineFields[0]?.field ?? "",
                headerLabel: lineFields[0]?.label ?? "Column",
                align: "left",
                format: "text",
              },
            ])
          }
        >
          <PlusIcon /> Add column
        </Button>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "totals_block") {
    const { rows } = block.config;
    function updateRows(next: typeof rows) {
      onChange(
        (b) => ({ ...b, config: { ...(b as typeof block).config, rows: next } }) as DesignBlock,
      );
    }
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.id} className="space-y-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1">
                <Input
                  value={row.label}
                  onChange={(e) =>
                    updateRows(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                  }
                  placeholder="Label"
                  className="flex-1"
                />
                <ReorderButtons
                  onUp={() => updateRows(move(rows, i, i - 1))}
                  onDown={() => updateRows(move(rows, i, i + 1))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => updateRows(rows.filter((_, j) => j !== i))}
                >
                  <TrashIcon />
                </Button>
              </div>
              <FieldSelect
                options={summaryFields}
                value={row.field}
                onChange={(field) =>
                  updateRows(rows.map((r, j) => (j === i ? { ...r, field } : r)))
                }
              />
              <PlainSelect
                value={row.visibleIf}
                onChange={(v) =>
                  updateRows(
                    rows.map((r, j) =>
                      j === i ? { ...r, visibleIf: v as "always" | "field-truthy" } : r,
                    ),
                  )
                }
                options={[
                  { value: "always", label: "Always show" },
                  { value: "field-truthy", label: "Only if it has a value" },
                ]}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`emph-${row.id}`}
                  checked={row.emphasis}
                  onCheckedChange={(checked) =>
                    updateRows(
                      rows.map((r, j) => (j === i ? { ...r, emphasis: Boolean(checked) } : r)),
                    )
                  }
                />
                <Label htmlFor={`emph-${row.id}`}>Emphasize (e.g. grand total)</Label>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updateRows([
              ...rows,
              {
                id: crypto.randomUUID(),
                label: summaryFields[0]?.label ?? "Field",
                field: summaryFields[0]?.field ?? "",
                visibleIf: "always",
                emphasis: false,
              },
            ])
          }
        >
          <PlusIcon /> Add row
        </Button>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "free_text") {
    const allFields = [...scalarFields, ...summaryFields];
    return (
      <div className="space-y-3">
        <Field label="Content">
          <Textarea
            rows={5}
            value={block.config.content}
            onChange={(e) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, content: e.target.value },
                  }) as DesignBlock,
              )
            }
          />
        </Field>
        <Field label="Insert a field">
          <PlainSelect
            value=""
            onChange={(field) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: {
                      ...(b as typeof block).config,
                      content: `${(b as typeof block).config.content}{{${field}}}`,
                    },
                  }) as DesignBlock,
              )
            }
            options={allFields.map((f) => ({ value: f.field, label: f.label }))}
          />
        </Field>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div className="space-y-3">
        <Field label="Kind">
          <PlainSelect
            value={block.config.kind}
            onChange={(v) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, kind: v as "line" | "space" },
                  }) as DesignBlock,
              )
            }
            options={[
              { value: "line", label: "Line" },
              { value: "space", label: "Space" },
            ]}
          />
        </Field>
        <Field label="Height (px)">
          <Input
            type="number"
            min={1}
            max={200}
            value={block.config.heightPx ?? ""}
            onChange={(e) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: {
                      ...(b as typeof block).config,
                      heightPx: e.target.value ? Number(e.target.value) : undefined,
                    },
                  }) as DesignBlock,
              )
            }
          />
        </Field>
      </div>
    );
  }

  if (block.type === "signature") {
    const { config } = block;
    return (
      <div className="space-y-3">
        <Field label="Label">
          <Input
            value={config.label}
            onChange={(e) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, label: e.target.value },
                  }) as DesignBlock,
              )
            }
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id="showForStoreLine"
            checked={config.showForStoreLine}
            onCheckedChange={(checked) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, showForStoreLine: Boolean(checked) },
                  }) as DesignBlock,
              )
            }
          />
          <Label htmlFor="showForStoreLine">Show &quot;For {"{Store Name}"}&quot;</Label>
        </div>
        <Field label="Align">
          <PlainSelect
            value={config.align}
            onChange={(v) =>
              onChange(
                (b) =>
                  ({
                    ...b,
                    config: { ...(b as typeof block).config, align: v as "left" | "right" },
                  }) as DesignBlock,
              )
            }
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
        <StylePanel style={block.style} onChange={updateStyle} />
      </div>
    );
  }

  return null;
}

function FieldSelect({
  options,
  value,
  onChange,
}: {
  options: MergeFieldOption[];
  value: string;
  onChange: (field: string) => void;
}) {
  return (
    <PlainSelect
      value={value}
      onChange={onChange}
      options={options.map((f) => ({ value: f.field, label: f.label }))}
    />
  );
}
