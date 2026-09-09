"use client";

import { useCallback } from "react";

import type { SearchableSelectOption } from "@/components/searchable-select";

// The HSN Code master is a full GST catalog (20,000+ rows) — too large to
// fetch and render as a flat list like every other master's dropdown, so
// the picker searches server-side instead. See app/api/hsn-codes/options.
export function useHsnCodeSearch(): {
  onSearch: (query: string) => Promise<SearchableSelectOption[]>;
  resolveLabel: (value: string) => Promise<string | null>;
} {
  const onSearch = useCallback(async (query: string) => {
    const res = await fetch(`/api/hsn-codes/options?search=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { data: { id: string; hsnCode: string }[] };
    return body.data.map((row) => ({ value: row.id, label: row.hsnCode }));
  }, []);

  const resolveLabel = useCallback(async (value: string) => {
    const res = await fetch(`/api/hsn-codes/options?id=${encodeURIComponent(value)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { id: string; hsnCode: string }[] };
    return body.data[0]?.hsnCode ?? null;
  }, []);

  return { onSearch, resolveLabel };
}
