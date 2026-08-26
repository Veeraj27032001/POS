import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/lib/config/env";

import type { StorageAdapter } from "./types";

let cachedClient: S3Client | null = null;

function client() {
  if (cachedClient) return cachedClient;
  const {
    SUPABASE_URL,
    SUPABASE_S3_ACCESS_KEY_ID,
    SUPABASE_S3_SECRET_ACCESS_KEY,
    SUPABASE_S3_REGION,
  } = env();
  if (!SUPABASE_URL || !SUPABASE_S3_ACCESS_KEY_ID || !SUPABASE_S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "STORAGE_ADAPTER=supabase requires SUPABASE_URL, SUPABASE_S3_ACCESS_KEY_ID, and " +
        "SUPABASE_S3_SECRET_ACCESS_KEY (Supabase → Settings → Storage → S3 Connection).",
    );
  }
  cachedClient = new S3Client({
    endpoint: `${SUPABASE_URL}/storage/v1/s3`,
    region: SUPABASE_S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: SUPABASE_S3_ACCESS_KEY_ID,
      secretAccessKey: SUPABASE_S3_SECRET_ACCESS_KEY,
    },
  });
  return cachedClient;
}

function publicUrl(key: string): string {
  return `${env().SUPABASE_URL}/storage/v1/object/public/${env().SUPABASE_STORAGE_BUCKET}/${key}`;
}

export const supabaseStorageAdapter: StorageAdapter = {
  async put({ key, contentType, body }) {
    await client().send(
      new PutObjectCommand({
        Bucket: env().SUPABASE_STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { url: publicUrl(key) };
  },

  async get(key) {
    const res = await client().send(
      new GetObjectCommand({ Bucket: env().SUPABASE_STORAGE_BUCKET, Key: key }),
    );
    if (!res.Body) throw new Error(`Supabase Storage object not found: ${key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  },

  async remove(key) {
    await client().send(
      new DeleteObjectCommand({ Bucket: env().SUPABASE_STORAGE_BUCKET, Key: key }),
    );
  },

  keyFromUrl(url) {
    const prefix = `${env().SUPABASE_URL}/storage/v1/object/public/${env().SUPABASE_STORAGE_BUCKET}/`;
    return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
  },
};
