import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, RESERVED_QUERY_KEYS } from "./types";
import type { ListQueryParams } from "./types";

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function parseListQueryParams(searchParams: URLSearchParams): ListQueryParams {
  const page = toPositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    toPositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
  );
  const search = searchParams.get("search")?.trim() || undefined;
  const sort = searchParams.get("sort")?.trim() || undefined;
  const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  const filters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!RESERVED_QUERY_KEYS.has(key) && value !== "") {
      filters[key] = value;
    }
  }

  return { page, pageSize, search, sort, sortDir, filters };
}

export interface BuildListQueryStringParams extends Partial<Omit<ListQueryParams, "filters">> {
  filters?: Record<string, string | undefined>;
  countOnly?: boolean;
}

export function buildListQueryString(params: BuildListQueryStringParams): string {
  const sp = new URLSearchParams();
  if (params.page !== undefined) sp.set("page", String(params.page));
  if (params.pageSize !== undefined) sp.set("pageSize", String(params.pageSize));
  if (params.search) sp.set("search", params.search);
  if (params.sort) sp.set("sort", params.sort);
  if (params.sortDir) sp.set("sortDir", params.sortDir);
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== "") sp.set(key, value);
    }
  }
  if (params.countOnly) sp.set("countOnly", "1");
  return sp.toString();
}
