"use client";

import { useCallback } from "react";

import type { SearchableSelectOption } from "@/components/searchable-select";

export function useProductSearch(): {
  onSearch: (query: string) => Promise<SearchableSelectOption[]>;
} {
  const onSearch = useCallback(async (query: string) => {
    if (!query) return [];
    const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&pageSize=10`);
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: { id: string; name: string; systemBarcode: string }[];
    };
    return body.data.map((row) => ({ value: row.id, label: `${row.name} (${row.systemBarcode})` }));
  }, []);

  return { onSearch };
}
