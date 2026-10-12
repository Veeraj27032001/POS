"use client";

import type { SearchableSelectOption } from "@/components/searchable-select";
import { SearchableSelect } from "@/components/searchable-select";
import { useAvailableStock } from "@/lib/stock/useAvailableStock";
import { cn } from "@/lib/utils";

export function ProductSelectWithStock({
  value,
  onChange,
  products,
  warehouseId,
  placeholder = "Select product…",
  className,
  "data-kbd-item": dataKbdItem,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  products: SearchableSelectOption[];
  warehouseId: string | null | undefined;
  placeholder?: string;
  /** Lets a grid parent place this control, e.g. spanning a stacked row. */
  className?: string;
  "data-kbd-item"?: string;
}) {
  const available = useAvailableStock(warehouseId, value);

  return (
    <div className={cn("space-y-0.5", className)}>
      <SearchableSelect
        data-kbd-item={dataKbdItem}
        options={products}
        value={value ?? null}
        onChange={(v) => onChange(v ?? "")}
        placeholder={placeholder}
      />
      {value && (
        <p className="text-muted-foreground text-xs">
          {available === null ? "Loading stock…" : `In stock: ${available}`}
        </p>
      )}
    </div>
  );
}
