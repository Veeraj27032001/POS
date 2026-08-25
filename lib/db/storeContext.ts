import { AsyncLocalStorage } from "node:async_hooks";

export interface StoreContext {
  storeId: string | null;
  userId: string;
}

const storage = new AsyncLocalStorage<StoreContext>();

export async function runWithStoreContext<T>(
  context: StoreContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, async () => {
    return await fn();
  });
}

export function getStoreContext(): StoreContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "No store scoping context established for this request. Wrap the request handler in " +
        "runWithStoreContext(), or use the unscoped client explicitly for code that intentionally " +
        "bypasses store scoping (seed scripts, cross-store platform jobs).",
    );
  }
  return ctx;
}

export function tryGetStoreContext(): StoreContext | undefined {
  return storage.getStore();
}
