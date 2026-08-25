"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { buildListQueryString } from "./queryParams";
import type { ListResponse } from "./types";

export interface ListParams {
  resource: string;
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, string | undefined>;
}

function normalizedFilters(filters?: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  if (!filters) return result;
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") result[key] = value;
  }
  return result;
}

function listQueryKey(params: ListParams, extra?: string) {
  return [
    "list",
    params.resource,
    params.page,
    params.pageSize,
    params.search ?? null,
    params.sort ?? null,
    params.sortDir ?? null,
    normalizedFilters(params.filters),
    extra ?? null,
  ] as const;
}

async function fetchList<T>(params: ListParams, countOnly: boolean, signal: AbortSignal) {
  const qs = buildListQueryString({
    page: countOnly ? undefined : params.page,
    pageSize: params.pageSize,
    search: params.search,
    sort: countOnly ? undefined : params.sort,
    sortDir: countOnly ? undefined : params.sortDir,
    filters: normalizedFilters(params.filters),
    countOnly,
  });
  const response = await fetch(`/api/${params.resource}?${qs}`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load ${params.resource} (${response.status})`);
  }
  return (await response.json()) as ListResponse<T>;
}

export function useListCount(params: Omit<ListParams, "page" | "sort" | "sortDir">) {
  return useQuery({
    queryKey: listQueryKey({ ...params, page: 0 }, "count"),
    queryFn: ({ signal }) => fetchList<never>({ ...params, page: 1 }, true, signal),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
}

export function usePaginatedList<T>(params: ListParams) {
  return useQuery({
    queryKey: listQueryKey(params),
    queryFn: ({ signal }) => fetchList<T>(params, false, signal),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
}

export function useInvalidateResource() {
  const queryClient = useQueryClient();
  return (resource: string) => queryClient.invalidateQueries({ queryKey: ["list", resource] });
}
