import { prismaBase } from "./client";
import { getStoreContext } from "./storeContext";
import { STORE_SCOPED_MODELS } from "./storeScopedModels";

const WHERE_SCOPED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

export const prisma = prismaBase.$extends({
  name: "storeScoping",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!STORE_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const context = getStoreContext();
        if (context.storeId === null) {
          return query(args);
        }

        if (WHERE_SCOPED_OPERATIONS.has(operation)) {
          const scopedArgs = args as { where?: Record<string, unknown> };
          scopedArgs.where = { ...scopedArgs.where, storeId: context.storeId };
        }

        return query(args);
      },
    },
  },
});

export { runWithStoreContext, tryGetStoreContext } from "./storeContext";
export type { StoreContext } from "./storeContext";
export { STORE_SCOPED_MODELS } from "./storeScopedModels";

export function unscoped() {
  return prismaBase;
}
