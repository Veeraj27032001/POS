import { describe, expect, it } from "vitest";

import { formatRelativeOrAbsolute } from "./relative";

const now = new Date("2026-08-19T12:00:00.000Z");

describe("formatRelativeOrAbsolute", () => {
  it("shows 'just now' for a timestamp seconds ago", () => {
    const result = formatRelativeOrAbsolute(new Date("2026-08-19T11:59:55.000Z"), now);
    expect(result.isRelative).toBe(true);
    expect(result.display).toBe("just now");
  });

  it("shows minutes ago inside the window", () => {
    const result = formatRelativeOrAbsolute(new Date("2026-08-19T11:45:00.000Z"), now);
    expect(result.isRelative).toBe(true);
    expect(result.display).toBe("15 minutes ago");
  });

  it("shows hours ago inside the window", () => {
    const result = formatRelativeOrAbsolute(new Date("2026-08-19T09:00:00.000Z"), now);
    expect(result.isRelative).toBe(true);
    expect(result.display).toBe("3 hours ago");
  });

  it("falls back to absolute once past the window", () => {
    const result = formatRelativeOrAbsolute(new Date("2026-08-17T12:00:00.000Z"), now);
    expect(result.isRelative).toBe(false);
    expect(result.display).toBe(result.absolute);
  });

  it("always exposes the absolute value alongside a relative one", () => {
    const result = formatRelativeOrAbsolute(new Date("2026-08-19T11:45:00.000Z"), now);
    expect(result.absolute).not.toBe(result.display);
    expect(result.absolute.length).toBeGreaterThan(0);
  });

  it("respects a custom window size", () => {
    const result = formatRelativeOrAbsolute(new Date("2026-08-19T09:00:00.000Z"), now, {
      windowHours: 2,
    });
    expect(result.isRelative).toBe(false);
  });
});
