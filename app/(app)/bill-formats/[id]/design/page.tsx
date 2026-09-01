"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { BlockPalette } from "@/components/billing/design-builder/block-palette";
import { PropertyPanel } from "@/components/billing/design-builder/property-panel";
import { SortableBlockChip } from "@/components/billing/design-builder/sortable-block-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { BillFormatKind, BillType } from "@/generated/prisma/client";
import {
  BLOCK_TYPE_LABELS,
  type BillFormatDesign,
  type DesignBlock,
  type DesignBlockType,
} from "@/lib/billing/billFormatDesign.types";
import { compileBillFormatDesign } from "@/lib/billing/compileBillFormatDesign";
import { DEFAULT_BILL_FORMAT_DESIGNS } from "@/lib/billing/defaultBillFormatDesigns";
import { createDefaultBlock } from "@/lib/billing/newDesignBlock";
import { useBillFormatPreview } from "@/lib/billing/useBillFormatPreview";

interface BillFormatRow {
  id: string;
  name: string;
  formatKind: BillFormatKind;
  billType: BillType;
  templateHtml: string;
  designJson: BillFormatDesign | null;
}

const FORMAT_KIND_LABELS: Record<string, string> = {
  receipt: "Receipt",
  bill: "Bill",
  credit_note: "Credit Note",
  refund: "Refund",
};
const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

function CanvasDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "canvas-drop" });
  return (
    <div ref={setNodeRef} className="bg-muted/20 min-h-full overflow-y-auto rounded-md border p-3">
      {children}
    </div>
  );
}

export default function BillFormatDesignPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<BillFormatRow | null | undefined>(undefined);
  const [design, setDesign] = useState<BillFormatDesign | null>(null);
  const [html, setHtml] = useState("");
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [htmlUnlocked, setHtmlUnlocked] = useState(false);
  const [mode, setMode] = useState<"visual" | "html">("html");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    html: string;
    design: BillFormatDesign | null;
  } | null>(null);
  const { previewHtml, loading: previewLoading, runPreview } = useBillFormatPreview();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    fetch(`/api/bill-formats/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BillFormatRow | null) => {
        setRow(data);
        if (data) {
          const initialDesign = data.designJson ?? null;
          setDesign(initialDesign);
          setHtml(data.templateHtml);
          setMode(initialDesign ? "visual" : "html");
          setSavedSnapshot({ html: data.templateHtml, design: initialDesign });
        }
      });
  }, [id]);

  const displayedHtml = design && !htmlDirty ? compileBillFormatDesign(design) : html;
  const isDirty = savedSnapshot
    ? displayedHtml !== savedSnapshot.html ||
      JSON.stringify(design) !== JSON.stringify(savedSnapshot.design)
    : false;
  const selectedBlock = design?.blocks.find((b) => b.id === selectedBlockId) ?? null;

  function updateBlock(blockId: string, updater: (block: DesignBlock) => DesignBlock) {
    setDesign((prev) =>
      prev
        ? { ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)) }
        : prev,
    );
  }

  function removeBlock(blockId: string) {
    setDesign((prev) =>
      prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev,
    );
    setSelectedBlockId((cur) => (cur === blockId ? null : cur));
  }

  function addBlock(type: DesignBlockType) {
    if (!design) return;
    const block = createDefaultBlock(type, design.formatKind);
    setDesign({ ...design, blocks: [...design.blocks, block] });
    setSelectedBlockId(block.id);
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      { source?: string; blockType?: DesignBlockType } | undefined;
    if (data?.source === "palette" && data.blockType) {
      setActiveDragLabel(BLOCK_TYPE_LABELS[data.blockType]);
      return;
    }
    const block = design?.blocks.find((b) => b.id === event.active.id);
    setActiveDragLabel(block ? BLOCK_TYPE_LABELS[block.type] : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null);
    const { active, over } = event;
    if (!over || !design) return;
    const activeData = active.data.current as
      { source?: string; blockType?: DesignBlockType } | undefined;

    if (activeData?.source === "palette" && activeData.blockType) {
      const newBlock = createDefaultBlock(activeData.blockType, design.formatKind);
      const overIndex = design.blocks.findIndex((b) => b.id === over.id);
      const blocks = [...design.blocks];
      if (overIndex === -1) blocks.push(newBlock);
      else blocks.splice(overIndex, 0, newBlock);
      setDesign({ ...design, blocks });
      setSelectedBlockId(newBlock.id);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = design.blocks.findIndex((b) => b.id === active.id);
      const newIndex = design.blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      setDesign({ ...design, blocks: arrayMove(design.blocks, oldIndex, newIndex) });
    }
  }

  function handleModeChange(value: unknown) {
    const next = value as string;
    if (next !== "visual" && next !== "html") return;
    if (next === mode) return;
    if (next === "visual") {
      if (!design) return;
      if (htmlDirty) {
        if (
          !window.confirm("Switching to Visual mode will discard your manual HTML edits. Continue?")
        )
          return;
        setHtmlDirty(false);
      }
      setMode("visual");
    } else {
      setHtmlUnlocked(false);
      setMode("html");
    }
  }

  function startVisualDesign() {
    if (!row) return;
    const seeded = structuredClone(DEFAULT_BILL_FORMAT_DESIGNS[row.formatKind]);
    setDesign(seeded);
    setMode("visual");
  }

  function handleHtmlTextChange(value: string) {
    setHtml(value);
    if (design) setHtmlDirty(true);
  }

  async function handleSave() {
    const useManualHtml = design === null || htmlDirty;
    if (useManualHtml && design !== null) {
      if (
        !window.confirm(
          "Saving your manual HTML edits will clear the visual design for this format. Continue?",
        )
      ) {
        return;
      }
    }
    const nextTemplateHtml = useManualHtml ? html : compileBillFormatDesign(design!);
    const nextDesignJson = useManualHtml ? null : design;
    setSaving(true);
    try {
      const res = await fetch(`/api/bill-formats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateHtml: nextTemplateHtml, designJson: nextDesignJson }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save.");
        return;
      }
      setDesign(nextDesignJson);
      setHtml(nextTemplateHtml);
      setHtmlDirty(false);
      setSavedSnapshot({ html: nextTemplateHtml, design: nextDesignJson });
      toast.success("Bill format design saved.");
    } finally {
      setSaving(false);
    }
  }

  if (row === undefined) {
    return <p className="text-muted-foreground p-8">Loading…</p>;
  }
  if (row === null) {
    return <p className="text-muted-foreground p-8">Bill format not found.</p>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="bg-background flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/bill-formats/${id}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Back
          </Link>
          <span className="font-medium">{row.name}</span>
          <Badge variant="outline">{FORMAT_KIND_LABELS[row.formatKind] ?? row.formatKind}</Badge>
          <Badge variant="outline">{BILL_TYPE_LABELS[row.billType] ?? row.billType}</Badge>
          {isDirty && <Badge variant="secondary">Unsaved changes</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList>
              <TabsTrigger value="visual" disabled={!design}>
                Visual
              </TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void runPreview(row.formatKind, displayedHtml).then(
                (html) => html !== null && setPreviewOpen(true),
              )
            }
            disabled={previewLoading}
          >
            {previewLoading ? "Rendering…" : "Preview"}
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {mode === "visual" && design && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid flex-1 grid-cols-[220px_1fr_320px] gap-4 overflow-hidden p-4">
            <div className="overflow-y-auto">
              <BlockPalette onAdd={addBlock} />
            </div>
            <CanvasDropZone>
              <SortableContext
                items={design.blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {design.blocks.length === 0 && (
                    <p className="text-muted-foreground p-4 text-center text-sm">
                      Drag a block here, or click one in the palette to get started.
                    </p>
                  )}
                  {design.blocks.map((block) => (
                    <SortableBlockChip
                      key={block.id}
                      block={block}
                      selected={block.id === selectedBlockId}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </CanvasDropZone>
            <div className="overflow-y-auto border-l pl-4">
              {selectedBlock ? (
                <PropertyPanel
                  block={selectedBlock}
                  formatKind={design.formatKind}
                  onChange={(updater) => updateBlock(selectedBlock.id, updater)}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Select a block to edit its properties.
                </p>
              )}
            </div>
          </div>
          <DragOverlay>
            {activeDragLabel && (
              <div className="bg-card rounded-md border px-3 py-2 text-sm shadow-lg">
                {activeDragLabel}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {mode === "html" && (
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {design === null && (
            <div className="bg-muted/30 rounded-md border p-3 text-sm">
              <p>This format was hand-written in HTML — Visual mode isn&apos;t available for it.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={startVisualDesign}
              >
                Start visual design
              </Button>
            </div>
          )}
          {design !== null && !htmlDirty && !htmlUnlocked && (
            <div className="bg-muted/30 flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <p>This is the compiled HTML from your visual design.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setHtml(displayedHtml);
                  setHtmlUnlocked(true);
                }}
              >
                Edit HTML directly (advanced)
              </Button>
            </div>
          )}
          {design !== null && (htmlDirty || htmlUnlocked) && (
            <p className="border-warning/40 bg-warning/10 rounded-md border p-3 text-sm">
              Manual edits here will replace your visual design when you save.
            </p>
          )}
          <Textarea
            value={displayedHtml}
            onChange={(e) => handleHtmlTextChange(e.target.value)}
            readOnly={design !== null && !htmlDirty && !htmlUnlocked}
            className="min-h-[32rem] font-mono text-xs"
          />
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>Preview with sample data</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              sandbox=""
              className="h-[70vh] w-full flex-1 rounded-md border bg-white"
              title="Bill format preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
