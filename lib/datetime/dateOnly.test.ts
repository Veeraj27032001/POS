import { describe, expect, it } from "vitest";

import {
  compareDateOnly,
  dateOnlyToUtcMidnight,
  formatDateOnly,
  isDateOnlyAfter,
  isDateOnlyBefore,
  toDateOnly,
} from "./dateOnly";

describe("toDateOnly", () => {
  it("extracts the UTC calendar date from a Date, never a local one", () => {
    const date = new Date("2026-03-01T23:30:00.000Z");
    expect(toDateOnly(date)).toBe("2026-03-01");
  });

  it("does not shift a late-night UTC timestamp into the next day", () => {
    const date = new Date(Date.UTC(2026, 2, 1, 23, 59, 59));
    expect(toDateOnly(date)).toBe("2026-03-01");
  });

  it("parses an ISO date string without invoking timezone math", () => {
    expect(toDateOnly("2026-03-01T18:45:00.000+05:30")).toBe("2026-03-01");
  });

  it("rejects a malformed value", () => {
    expect(() => toDateOnly("not-a-date")).toThrow();
  });
});

describe("formatDateOnly", () => {
  const value = toDateOnly("2026-03-01");

  it("formats DD/MM/YYYY by default", () => {
    expect(formatDateOnly(value)).toBe("01/03/2026");
  });

  it("formats MM/DD/YYYY when requested", () => {
    expect(formatDateOnly(value, "MM/DD/YYYY")).toBe("03/01/2026");
  });
});

describe("compareDateOnly / isDateOnlyBefore / isDateOnlyAfter", () => {
  const earlier = toDateOnly("2026-01-01");
  const later = toDateOnly("2026-12-31");

  it("orders lexicographically, which is calendar order for YYYY-MM-DD", () => {
    expect(compareDateOnly(earlier, later)).toBeLessThan(0);
    expect(compareDateOnly(later, earlier)).toBeGreaterThan(0);
    expect(compareDateOnly(earlier, earlier)).toBe(0);
  });

  it("isDateOnlyBefore/isDateOnlyAfter agree with compareDateOnly", () => {
    expect(isDateOnlyBefore(earlier, later)).toBe(true);
    expect(isDateOnlyAfter(later, earlier)).toBe(true);
    expect(isDateOnlyBefore(later, earlier)).toBe(false);
  });
});

describe("dateOnlyToUtcMidnight", () => {
  it("round-trips back to the same calendar date via toDateOnly", () => {
    const value = toDateOnly("2026-06-15");
    const date = dateOnlyToUtcMidnight(value);
    expect(toDateOnly(date)).toBe(value);
    expect(date.getUTCHours()).toBe(0);
  });
});
