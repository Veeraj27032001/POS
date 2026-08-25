import type { DateDisplayFormat } from "./constants";
import { DEFAULT_DATE_FORMAT } from "./constants";

export type DateOnly = string & { readonly __brand: "DateOnly" };

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function toDateOnly(input: string | Date): DateOnly {
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}` as DateOnly;
  }

  const match = DATE_ONLY_PATTERN.exec(input);
  if (!match) {
    throw new Error(`Invalid date-only value: ${input}`);
  }
  return `${match[1]}-${match[2]}-${match[3]}` as DateOnly;
}

export function todayAsDateOnly(): DateOnly {
  return toDateOnly(new Date());
}

export function formatDateOnly(
  value: DateOnly,
  format: DateDisplayFormat = DEFAULT_DATE_FORMAT,
): string {
  const [y, m, d] = value.split("-");
  return format === "DD/MM/YYYY" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isDateOnlyBefore(a: DateOnly, b: DateOnly): boolean {
  return compareDateOnly(a, b) < 0;
}

export function isDateOnlyAfter(a: DateOnly, b: DateOnly): boolean {
  return compareDateOnly(a, b) > 0;
}

export function dateOnlyToUtcMidnight(value: DateOnly): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
