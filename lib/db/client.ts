import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/lib/config/env";

const globalForPrisma = globalThis as unknown as {
  __prismaAdapter: PrismaPg | undefined;
  __prismaBase: PrismaClient | undefined;
};

function createAdapter(): PrismaPg {
  const { DATABASE_URL } = env();
  // getStockLevels() alone fires ~11 queries via Promise.all, and callers
  // that check several warehouses (billing's oversell/allocation checks)
  // fire one getStockLevels() per warehouse in parallel on top of that — a
  // pool this small was queuing badly under real warehouse counts. This
  // goes through Supabase's pooled connection (pgbouncer), which is built
  // to absorb a larger client-side pool without a proportional increase in
  // real Postgres backend connections.
  return new PrismaPg({
    connectionString: DATABASE_URL,
    max: 30,
    connectionTimeoutMillis: 10_000,
  });
}

const adapter = globalForPrisma.__prismaAdapter ?? createAdapter();

export const prismaBase =
  globalForPrisma.__prismaBase ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaAdapter = adapter;
  globalForPrisma.__prismaBase = prismaBase;
}
