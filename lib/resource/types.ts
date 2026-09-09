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
  /** Maps a unique field's Prisma name (and/or its snake_case DB column
   * name) to a human-friendly label, used to turn a raw P2002 conflict into
   * "A record with this Manufacturer barcode already exists." instead of a
   * generic or DB-internal message. */
  uniqueFieldLabels?: Record<string, string>;
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
  /** Runs only after the record is actually created — the right place for
   * side effects like sending an email, so a failed create (e.g. a
   * duplicate-email conflict) never fires them. `originalData` is the
   * create input before beforeCreate transformed it, e.g. to recover a
   * plain password that beforeCreate replaced with its hash. */
  afterCreate?: (
    created: Record<string, unknown>,
    originalData: Record<string, unknown>,
    session: AppSession,
  ) => void | Promise<void>;
  /** Runs only after an update actually commits — the right place for side
   * effects like logging a change, so a rejected/failed update never fires
   * them. `existing` is the record as it was before this update. */
  afterUpdate?: (
    updated: Record<string, unknown>,
    existing: Record<string, unknown>,
    session: AppSession,
  ) => void | Promise<void>;
  /** Runs before a (soft) delete — return a rejection to block it, e.g. a
   * master still referenced by real transactional records (stock documents,
   * bills, shifts). Deliberately not a Prisma-relation "cannot delete"
   * error: soft delete never hits a real FK constraint, so without this the
   * record would just quietly disappear from every list while every row
   * still pointing at it keeps working, silently orphaning history. Return
   * null to allow the delete. */
  beforeDelete?: (
    existing: Record<string, unknown>,
    session: AppSession,
  ) => ResourceHookRejection | null | Promise<ResourceHookRejection | null>;
  /** Extra `where` conditions merged into every read/write, e.g. to hide
   * higher-privilege rows from lower-privilege viewers (Users' role
   * hierarchy). Applied on top of, never instead of, store scoping. */
  extraWhere?: (session: AppSession) => Record<string, unknown>;
}
