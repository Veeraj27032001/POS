import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/lib/config/env";

const globalForPrisma = globalThis as unknown as {
  __prismaAdapter: PrismaPg | undefined;
  __prismaBase: PrismaClient | undefined;
};

function createAdapter(): PrismaPg {
  const { DATABASE_URL } = env();
  return new PrismaPg({
    connectionString: DATABASE_URL,
    max: 10,
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
