import { describe, expect, it, vi } from "vitest";

import { retryWithBackoff } from "./retryWithBackoff";

describe("retryWithBackoff", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds within the attempt budget", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail 1")).mockResolvedValueOnce("ok");
    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts and throws the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(
      "always fails",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("passes the attempt number to the callback", async () => {
    const attempts: number[] = [];
    const fn = vi.fn().mockImplementation(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) throw new Error("retry me");
      return "done";
    });
    const result = await retryWithBackoff(fn, { maxAttempts: 5, baseDelayMs: 1 });
    expect(result).toBe("done");
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("defaults to 3 attempts when not specified", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(retryWithBackoff(fn, { baseDelayMs: 1 })).rejects.toThrow("nope");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
