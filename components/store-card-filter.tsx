"use client";

import { useEffect } from "react";

import { useOptionsList } from "@/lib/masters/useOptionsList";
import { cn } from "@/lib/utils";

export interface StoreCardFilterProps {
  value: string | null;
  onChange: (storeId: string) => void;
}

export function StoreCardFilter({ value, onChange }: StoreCardFilterProps) {
  const stores = useOptionsList("stores/options", "name");

  useEffect(() => {
    if (!value && stores.length > 0) onChange(stores[0].value);
  }, [stores, value, onChange]);

  if (stores.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {stores.map((store) => (
        <button
          key={store.value}
          type="button"
          data-kbd-item=""
          onClick={() => onChange(store.value)}
          aria-pressed={value === store.value}
          className={cn(
            "rounded-lg border px-4 py-2 text-sm transition-colors",
            value === store.value
              ? "border-primary bg-primary/10 font-medium"
              : "hover:bg-accent/50",
          )}
        >
          {store.label}
        </button>
      ))}
    </div>
  );
}
