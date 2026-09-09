import { del, put } from "@vercel/blob";

import { env } from "@/lib/config/env";

import type { StorageAdapter } from "./types";

function token(): string {
  const value = env().BLOB_READ_WRITE_TOKEN;
  if (!value) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set — connect a Blob store to this Vercel project " +
        "(Storage tab), or set it manually for local dev.",
    );
  }
  return value;
}

// Only used for the desktop-app installer upload — everything else stays on
// the configured StorageAdapter (Supabase). Keys here are the full blob URL
// Vercel returns, not a separate namespaced key, since that's what del()
// itself expects.
export const vercelBlobStorageAdapter: StorageAdapter = {
  async put({ key, contentType, body }) {
    const blob = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      multipart: true,
      token: token(),
    });
    return { url: blob.downloadUrl };
  },

  async get(key) {
    const res = await fetch(key);
    if (!res.ok) throw new Error(`Vercel Blob object not found: ${key}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async remove(key) {
    await del(key, { token: token() });
  },

  keyFromUrl(url) {
    return url.includes(".public.blob.vercel-storage.com/") ? url : null;
  },
};
