import type { ZodType } from "zod";

import type { AppSession } from "@/lib/auth/types";

export type ResourceScoping = "none" | "required" | "optional";

/** A hook can reject the write by returning this instead of data. */
export interface ResourceHookRejection {
  forbidden: string;
}

export type ResourceHookResult = Record<string, unknown> | ResourceHookRejection;

export function isResourceHookRejection(
  result: ResourceHookResult,
): result is ResourceHookRejection {
  return "forbidden" in result;
}

export interface ResourceDelegate {
  count(args: { where?: Record<string, unknown> }): Promise<number>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    skip: number;
    take: number;
  }): Promise<Record<string, unknown>[]>;
  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
}

export interface ResourceConfig<TCreate, TUpdate> {
  name: string;
  module: string;
  scoping: ResourceScoping;
  createSchema: ZodType<TCreate>;
  updateSchema: ZodType<TUpdate>;
  searchFields?: string[];
  getDelegate: (client: unknown) => ResourceDelegate;
  hasIsActive?: boolean;
  explicitStoreId?: boolean;
  defaultSort?: Record<string, "asc" | "desc">;
  beforeCreate?: (
    data: Record<string, unknown>,
    session: AppSession,
  ) => ResourceHookResult | Promise<ResourceHookResult>;
  beforeUpdate?: (
    data: Record<string, unknown>,
    existing: Record<string, unknown>,
    session: AppSession,
  ) => ResourceHookResult | Promise<ResourceHookResult>;
  /** Extra `where` conditions merged into every read/write, e.g. to hide
   * higher-privilege rows from lower-privilege viewers (Users' role
   * hierarchy). Applied on top of, never instead of, store scoping. */
  extraWhere?: (session: AppSession) => Record<string, unknown>;
}
