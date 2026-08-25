import { formatInTimeZone } from "date-fns-tz";

import type { DateDisplayFormat } from "./constants";
import { DEFAULT_DATE_FORMAT, DEFAULT_HOUR12, DEFAULT_TIMEZONE } from "./constants";

export interface DateTimeDisplayOptions {
  timeZone?: string;
  dateFormat?: DateDisplayFormat;
  hour12?: boolean;
}

function datePattern(dateFormat: DateDisplayFormat): string {
  return dateFormat === "DD/MM/YYYY" ? "dd/MM/yyyy" : "MM/dd/yyyy";
}

export function formatTimestamp(
  value: Date | string,
  options: DateTimeDisplayOptions = {},
): string {
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const dateFormat = options.dateFormat ?? DEFAULT_DATE_FORMAT;
  const hour12 = options.hour12 ?? DEFAULT_HOUR12;
  const date = typeof value === "string" ? new Date(value) : value;
  const timePattern = hour12 ? "hh:mm a" : "HH:mm";
  return formatInTimeZone(date, timeZone, `${datePattern(dateFormat)} ${timePattern}`);
}

export function formatDatePart(value: Date | string, options: DateTimeDisplayOptions = {}): string {
  const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
  const dateFormat = options.dateFormat ?? DEFAULT_DATE_FORMAT;
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(date, timeZone, datePattern(dateFormat));
}
