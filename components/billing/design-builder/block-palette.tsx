"use client";

import { useDraggable } from "@dnd-kit/core";

import { BLOCK_TYPE_LABELS, type DesignBlockType } from "@/lib/billing/billFormatDesign.types";
import { cn } from "@/lib/utils";

const BLOCK_TYPES: DesignBlockType[] = [
  "header",
  "logo",
  "title_text",
  "meta_grid",
  "item_table",
  "totals_block",
  "free_text",
  "divider",
  "signature",
];

function PaletteCard({
  type,
  onAdd,
}: {
  type: DesignBlockType;
  onAdd: (type: DesignBlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", blockType: type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-kbd-item=""
      onClick={() => onAdd(type)}
      className={cn(
        "bg-card hover:bg-accent hover:text-accent-foreground w-full cursor-grab rounded-md border px-3 py-2 text-left text-sm active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...listeners}
      {...attributes}
    >
      {BLOCK_TYPE_LABELS[type]}
    </button>
  );
}

export function BlockPalette({ onAdd }: { onAdd: (type: DesignBlockType) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Drag a block onto the canvas, or click to add it.
      </p>
      <div className="space-y-1.5">
        {BLOCK_TYPES.map((type) => (
          <PaletteCard key={type} type={type} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}
