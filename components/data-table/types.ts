import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  /** Enables click-to-sort on this column's header. */
  sortable?: boolean;
  /** Backend field to sort by, if different from `key` (e.g. a computed/rendered column). */
  sortField?: string;
}

export interface DataTableProps<T> {
  resource: string;
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  searchable?: boolean;
  filters?: Record<string, string | undefined>;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  rowHref?: (row: T) => string;
}
