export interface ListResponse<T> {
  totalRecords: number;
  totalPages: number;
  page: number;
  pageSize: number;
  data: T[];
}

export interface ListQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  sortDir: "asc" | "desc";
  filters: Record<string, string>;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
export const RESERVED_QUERY_KEYS = new Set([
  "page",
  "pageSize",
  "search",
  "sort",
  "sortDir",
  "countOnly",
]);
