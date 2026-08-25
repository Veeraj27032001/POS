import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
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
