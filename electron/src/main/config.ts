import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { app } from "electron";
import dotenv from "dotenv";
import { z } from "zod";

// This is the Electron shell's own config — deliberately not the Next.js
// app's lib/config/env.ts, which validates server-side vars (DATABASE_URL
// etc.) that have no business being read by the desktop shell.
const configSchema = z.object({
  // The real, hosted app. This is the only place this URL lives — a
  // packaged installer with no bundled .env and no userData/config.json
  // override should still point at production out of the box. Local
  // development overrides this via electron/.env (git-ignored); a specific
  // till can be repointed after install via userData/config.json, neither
  // of which needs this file touched.
  SERVER_URL: z.url().default("https://pos.vedixsolutions.com"),
  KIOSK_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PRINTER_TRANSPORT: z.enum(["none", "network", "windows", "serial"]).default("none"),
  PRINTER_HOST: z.string().optional(),
  PRINTER_PORT: z.coerce.number().int().positive().optional(),
  PRINTER_WINDOWS_NAME: z.string().optional(),
  PRINTER_SERIAL_PATH: z.string().optional(),
  DOCUMENT_PRINTER_NAME: z.string().optional(),
});

export type ElectronConfig = z.infer<typeof configSchema>;

let cached: ElectronConfig | null = null;

// Precedence: a userData/config.json override (so one till can be pointed at
// its own printer/URL after install, no rebuild needed) -> the bundled
// electron/.env -> hard schema defaults.
export function loadConfig(): ElectronConfig {
  if (cached) return cached;

  dotenv.config({ path: join(app.getAppPath(), ".env"), quiet: true });

  let overrides: Record<string, unknown> = {};
  const overridePath = join(app.getPath("userData"), "config.json");
  if (existsSync(overridePath)) {
    try {
      overrides = JSON.parse(readFileSync(overridePath, "utf-8"));
    } catch (err) {
      console.error(`Failed to parse ${overridePath}:`, err);
    }
  }

  const merged = { ...process.env, ...overrides };
  const parsed = configSchema.safeParse(merged);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid Electron shell configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}
