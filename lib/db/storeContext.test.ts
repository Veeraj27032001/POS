import { describe, expect, it } from "vitest";

import { getStoreContext, runWithStoreContext, tryGetStoreContext } from "./storeContext";

describe("store context", () => {
  it("throws when no context has been established", () => {
    expect(() => getStoreContext()).toThrow(/No store scoping context/);
  });

  it("returns undefined from tryGetStoreContext when no context has been established", () => {
    expect(tryGetStoreContext()).toBeUndefined();
  });

  it("makes the context available inside runWithStoreContext", async () => {
    await runWithStoreContext({ storeId: "store-1", userId: "user-1" }, async () => {
      expect(getStoreContext()).toEqual({ storeId: "store-1", userId: "user-1" });
    });
  });

  it("supports an explicit null storeId for cross-store admin views", async () => {
    await runWithStoreContext({ storeId: null, userId: "admin-1" }, async () => {
      expect(getStoreContext().storeId).toBeNull();
    });
  });

  it("does not leak context across separate runWithStoreContext calls", async () => {
    await runWithStoreContext({ storeId: "store-1", userId: "user-1" }, async () => {
      expect(getStoreContext().storeId).toBe("store-1");
    });
    expect(tryGetStoreContext()).toBeUndefined();
  });

  it("keeps context alive across an awaited microtask inside the callback", async () => {
    await runWithStoreContext({ storeId: "store-1", userId: "user-1" }, async () => {
      await Promise.resolve();
      expect(getStoreContext().storeId).toBe("store-1");
    });
  });

  it("isolates context across concurrent async executions", async () => {
    const results: string[] = [];

    async function run(storeId: string) {
      return runWithStoreContext({ storeId, userId: "u" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, storeId === "store-a" ? 20 : 5));
        results.push(getStoreContext().storeId!);
      });
    }

    await Promise.all([run("store-a"), run("store-b")]);
    expect(results.sort()).toEqual(["store-a", "store-b"]);
  });
});
