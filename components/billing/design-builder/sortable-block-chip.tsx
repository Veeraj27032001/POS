"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BLOCK_TYPE_LABELS, type DesignBlock } from "@/lib/billing/billFormatDesign.types";
import { summarizeBlock } from "@/lib/billing/blockSummary";
import { cn } from "@/lib/utils";

export function SortableBlockChip({
  block,
  selected,
  onSelect,
  onRemove,
}: {
  block: DesignBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        "bg-card flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
        selected && "border-primary ring-primary/30 ring-2",
        isDragging && "opacity-40",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{BLOCK_TYPE_LABELS[block.type]}</div>
        <div className="text-muted-foreground truncate text-xs">{summarizeBlock(block)}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <TrashIcon className="size-3.5" />
      </Button>
    </div>
  );
}
