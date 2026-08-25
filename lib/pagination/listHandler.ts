import { NextResponse } from "next/server";

import { parseListQueryParams } from "./queryParams";
import type { ListQueryParams, ListResponse } from "./types";

export interface ListDelegate<TWhere, TOrderBy, TRecord> {
  count(args: { where?: TWhere }): Promise<number>;
  findMany(args: {
    where?: TWhere;
    orderBy?: TOrderBy;
    skip: number;
    take: number;
  }): Promise<TRecord[]>;
}

export interface CreateListHandlerOptions<TRecord, TWhere, TOrderBy> {
  delegate: () => ListDelegate<TWhere, TOrderBy, TRecord>;
  buildWhere?: (params: ListQueryParams) => TWhere | undefined;
  buildOrderBy?: (params: ListQueryParams) => TOrderBy | undefined;
}

export function createListHandler<TRecord, TWhere = never, TOrderBy = never>(
  options: CreateListHandlerOptions<TRecord, TWhere, TOrderBy>,
) {
  return async function GET(request: Request): Promise<NextResponse<ListResponse<TRecord>>> {
    const url = new URL(request.url);
    const params = parseListQueryParams(url.searchParams);
    const where = options.buildWhere?.(params);
    const delegate = options.delegate();

    const totalRecords = await delegate.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / params.pageSize));
    const page = Math.min(Math.max(1, params.page), totalPages);

    if (url.searchParams.get("countOnly") === "1") {
      return NextResponse.json({
        totalRecords,
        totalPages,
        page,
        pageSize: params.pageSize,
        data: [],
      });
    }

    const orderBy = options.buildOrderBy?.(params);
    const data = await delegate.findMany({
      where,
      orderBy,
      skip: (page - 1) * params.pageSize,
      take: params.pageSize,
    });

    return NextResponse.json({ totalRecords, totalPages, page, pageSize: params.pageSize, data });
  };
}
