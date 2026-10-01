"use client";

import { useEffect, useState } from "react";

import type { SearchableSelectOption } from "@/components/searchable-select";

export function useOptionsList(
  resource: string,
  labelField: string,
  extraQuery?: string,
  /** Row fields the option should also be findable by, without showing them
   * in the label — e.g. ["phone"] so a customer can be found by number. */
  keywordFields?: string[],
): SearchableSelectOption[] {
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const keywordKey = keywordFields?.join(",") ?? "";

  useEffect(() => {
    if (!resource) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/${resource}?pageSize=200${extraQuery ? `&${extraQuery}` : ""}`)
      .then((res) => res.json())
      .then((json: { data: Record<string, unknown>[] }) => {
        if (cancelled) return;
        setOptions(
          json.data
            .filter((row) => row.isActive !== false)
            .map((row) => ({
              value: String(row.id),
              label: String(row[labelField] ?? row.id),
              keywords: keywordKey
                ? keywordKey
                    .split(",")
                    .map((field) => row[field])
                    .filter((v) => v != null && v !== "")
                    .map(String)
                : undefined,
            })),
        );
      })
      .catch(() => setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [resource, labelField, extraQuery, keywordKey]);

  return options;
}
