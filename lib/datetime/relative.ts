import { RELATIVE_TIME_WINDOW_HOURS } from "./constants";
import type { DateTimeDisplayOptions } from "./format";
import { formatTimestamp } from "./format";

export interface RelativeTimeResult {
  display: string;
  absolute: string;
  isRelative: boolean;
}

export function formatRelativeOrAbsolute(
  value: Date | string,
  now: Date = new Date(),
  options: DateTimeDisplayOptions & { windowHours?: number } = {},
): RelativeTimeResult {
  const date = typeof value === "string" ? new Date(value) : value;
  const windowHours = options.windowHours ?? RELATIVE_TIME_WINDOW_HOURS;
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const absolute = formatTimestamp(date, options);

  if (diffHours < 0 || diffHours >= windowHours) {
    return { display: absolute, absolute, isRelative: false };
  }

  const diffMinutes = Math.round(diffMs / (1000 * 60));
  let display: string;
  if (diffMinutes < 1) {
    display = "just now";
  } else if (diffMinutes < 60) {
    display = `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  } else {
    const hours = Math.round(diffMinutes / 60);
    display = `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return { display, absolute, isRelative: true };
}
