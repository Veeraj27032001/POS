import { auth } from "@/auth";
import { runWithStoreContext } from "@/lib/db";
import { asAppSession } from "@/lib/auth/types";

export async function withStoreContext<T>(fn: () => Promise<T>): Promise<T> {
  const session = asAppSession(await auth());
  if (!session?.user) {
    throw new Error("withStoreContext called without an authenticated session.");
  }

  return runWithStoreContext({ storeId: session.user.storeId, userId: session.user.id }, fn);
}
