import { env } from "@/lib/config/env";

import { localStorageAdapter } from "./local";
import { supabaseStorageAdapter } from "./supabase";
import type { StorageAdapter } from "./types";

export type { StorageAdapter } from "./types";

let cached: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;
  cached = env().STORAGE_ADAPTER === "supabase" ? supabaseStorageAdapter : localStorageAdapter;
  return cached;
}
