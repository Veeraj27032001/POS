import { retryWithBackoff } from "./retryWithBackoff";

export interface UploadFileOptions {
  chunkSizeBytes?: number;
  /** Fraction (0–1) of chunks successfully sent so far. */
  onProgress?: (fraction: number) => void;
  /** Fires once all chunks are sent and the server is reassembling/storing the file. */
  onProcessingStart?: () => void;
  signal?: AbortSignal;
}

// Vercel Serverless Functions cap request bodies at 4.5 MB; stay safely under
// that (accounting for HTTP overhead) rather than the 5 MB spec default.
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_MB = 50;

// A handful of chunks in flight at once is meaningfully faster than fully
// sequential, without hitting the server with the whole file's worth of
// concurrent requests at once.
const CHUNK_CONCURRENCY = 3;

async function uploadChunksConcurrently(
  file: File,
  uploadId: string,
  chunkSize: number,
  totalChunks: number,
  onProgress: ((fraction: number) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {
  let nextIndex = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= totalChunks) return;

      const start = i * chunkSize;
      const chunk = file.slice(start, Math.min(file.size, start + chunkSize));

      await retryWithBackoff(async () => {
        const res = await fetch(`/api/uploads/${uploadId}/chunk/${i}`, {
          method: "PUT",
          body: chunk,
          signal,
        });
        if (!res.ok) {
          throw new Error(`Chunk ${i} failed (${res.status})`);
        }
      });

      completed += 1;
      onProgress?.(completed / totalChunks);
    }
  }

  const workerCount = Math.min(CHUNK_CONCURRENCY, totalChunks);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export async function uploadFile(
  file: File,
  options: UploadFileOptions = {},
): Promise<{ url: string }> {
  if (file.size > MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File exceeds the ${MAX_UPLOAD_FILE_SIZE_MB} MB upload limit.`);
  }

  const chunkSize = options.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE;
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  await uploadChunksConcurrently(
    file,
    uploadId,
    chunkSize,
    totalChunks,
    options.onProgress,
    options.signal,
  );

  options.onProcessingStart?.();

  const res = await fetch(`/api/uploads/${uploadId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      totalChunks,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Failed to finalize upload.");
  }

  return res.json();
}

/** Deletes a previously-uploaded file from storage, given the URL uploadFile() returned. */
export async function deleteUploadedFile(url: string): Promise<void> {
  const res = await fetch("/api/uploads/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Failed to delete file.");
  }
}
