import type { ZodType } from "zod";

export type ResourceScoping = "none" | "required" | "optional";

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
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}
