import { env } from "@/lib/config/env";

import { consoleNotifier } from "./console";
import { emailSmsNotifier } from "./email-sms";
import type { Notifier } from "./types";

export type { Notifier, NotificationMessage } from "./types";

let cached: Notifier | null = null;

export function getNotifier(): Notifier {
  if (cached) return cached;
  cached = env().NOTIFIER_ADAPTER === "email-sms" ? emailSmsNotifier : consoleNotifier;
  return cached;
}
