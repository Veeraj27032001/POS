"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useListCount, usePaginatedList } from "@/lib/pagination/useList";

import { LoadProgress } from "./load-progress";
import type { DataTableProps } from "./types";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataTable<T>({
  resource,
  columns,
  getRowId,
  searchable = false,
  filters,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  emptyMessage = "No records found.",
  rowHref,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const filtersKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    setPage(1);
  }, [search, filtersKey]);

  const countQuery = useListCount({ resource, pageSize, search, filters });
  const listQuery = usePaginatedList<T>({ resource, page, pageSize, search, filters });

  useEffect(() => {
    if (listQuery.data && listQuery.data.page !== page) {
      setPage(listQuery.data.page);
    }
  }, [listQuery.data, page]);

  const totalPages = listQuery.data?.totalPages ?? countQuery.data?.totalPages ?? 1;
  const totalRecords = listQuery.data?.totalRecords ?? countQuery.data?.totalRecords;
  const isInitialLoad = listQuery.isPending;
  const skeletonRowCount = Math.max(1, Math.min(pageSize, totalRecords ?? pageSize));

  return (
    <div className="space-y-3">
      {searchable && (
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search…"
          className="max-w-sm"
        />
      )}

      <LoadProgress active={listQuery.isFetching} />

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoad &&
              Array.from({ length: skeletonRowCount }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isInitialLoad && listQuery.isError && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center">
                  <p className="text-muted-foreground mb-2">Failed to load this page.</p>
                  <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {!isInitialLoad && !listQuery.isError && listQuery.data?.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground py-8 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}

            {!isInitialLoad &&
              !listQuery.isError &&
              listQuery.data?.data.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  className={rowHref ? "cursor-pointer" : undefined}
                  onClick={rowHref ? () => (window.location.href = rowHref(row)) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-muted-foreground text-sm">
          {totalRecords !== undefined
            ? `${totalRecords} record${totalRecords === 1 ? "" : "s"}`
            : ""}
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              if (v) setPageSize(Number(v));
            }}
            items={pageSizeOptions.map((size) => ({
              value: String(size),
              label: `${size} / page`,
            }))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
