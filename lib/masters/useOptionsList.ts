"use client";

import { useEffect, useState } from "react";

import type { SearchableSelectOption } from "@/components/searchable-select";

export function useOptionsList(resource: string, labelField: string): SearchableSelectOption[] {
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/${resource}?pageSize=200`)
      .then((res) => res.json())
      .then((json: { data: Record<string, unknown>[] }) => {
        if (cancelled) return;
        setOptions(
          json.data
            .filter((row) => row.isActive !== false)
            .map((row) => ({
              value: String(row.id),
              label: String(row[labelField] ?? row.id),
            })),
        );
      })
      .catch(() => setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [resource, labelField]);

  return options;
}
