import { retryWithBackoff } from "./retryWithBackoff";

export interface UploadFileOptions {
  chunkSizeBytes?: number;
  /** Fraction (0–1) of chunks successfully sent so far. */
  onProgress?: (fraction: number) => void;
  /** Fires once all chunks are sent and the server is reassembling/storing the file. */
  onProcessingStart?: () => void;
  signal?: AbortSignal;
  /**
   * When set, the server finishes reassembly/storage and attaches the
   * result to this record itself, in the background — the caller doesn't
   * need to stay connected for that to finish. In that case uploadFile()
   * resolves with `url: null` as soon as every chunk is sent; the record
   * gets updated independently, whether or not the caller is still around.
   */
  attachTo?: { resource: "products"; id: string; field: "images" | "videos" };
  /**
   * Raises the size ceiling for one specific, server-recognized upload kind
   * (an installer is 100+ MB, far past the general MAX_UPLOAD_FILE_SIZE_MB
   * meant for product media) — a fixed enum, not a client-suppliable number,
   * so the server stays the actual authority on what each kind allows.
   */
  sizeLimitKind?: "desktop-release";
}

// Vercel Serverless Functions cap request bodies at 4.5 MB; stay safely under
// that (accounting for HTTP overhead) rather than the 5 MB spec default.
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_MB = 50;
export const DESKTOP_RELEASE_MAX_UPLOAD_MB = 300;

// A handful of chunks in flight at once is meaningfully faster than fully
// sequential, without hitting the server with the whole file's worth of
// concurrent requests at once.
const CHUNK_CONCURRENCY = 3;

// fetch() has no upload-progress event, so a chunk only ever reports 0% or
// 100% — with a handful of large chunks that reads as big jumps (10% ->
// 20%) rather than smooth progress. XMLHttpRequest exposes real byte-level
// upload progress, which we report continuously as each chunk streams.
function putChunk(
  url: string,
  chunk: Blob,
  signal: AbortSignal | undefined,
  onBytesSent: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onBytesSent(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onBytesSent(chunk.size);
        resolve();
      } else {
        reject(new Error(`Chunk failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Chunk upload failed (network error)."));
    xhr.onabort = () => reject(new Error("Chunk upload aborted."));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(chunk);
  });
}

async function uploadChunksConcurrently(
  file: File,
  uploadId: string,
  chunkSize: number,
  totalChunks: number,
  onProgress: ((fraction: number) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {
  let nextIndex = 0;
  const bytesSentByChunk = new Array<number>(totalChunks).fill(0);

  function reportProgress() {
    const totalSent = bytesSentByChunk.reduce((sum, n) => sum + n, 0);
    onProgress?.(Math.min(1, totalSent / file.size));
  }

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= totalChunks) return;

      const start = i * chunkSize;
      const chunk = file.slice(start, Math.min(file.size, start + chunkSize));
      const url = `/api/uploads/${uploadId}/chunk/${i}`;

      await retryWithBackoff(async () => {
        bytesSentByChunk[i] = 0;
        await putChunk(url, chunk, signal, (loaded) => {
          bytesSentByChunk[i] = loaded;
          reportProgress();
        });
      });
    }
  }

  const workerCount = Math.min(CHUNK_CONCURRENCY, totalChunks);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export async function uploadFile(
  file: File,
  options: UploadFileOptions = {},
): Promise<{ url: string | null }> {
  const maxSizeMB =
    options.sizeLimitKind === "desktop-release"
      ? DESKTOP_RELEASE_MAX_UPLOAD_MB
      : MAX_UPLOAD_FILE_SIZE_MB;
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`File exceeds the ${maxSizeMB} MB upload limit.`);
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

  // Note: deliberately not passing `signal` here when attachTo is set —
  // this request only needs to reach the server and get acknowledged
  // (202), not stay open for the full merge. The server continues the
  // actual work independently of this request/connection either way.
  const res = await fetch(`/api/uploads/${uploadId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      totalChunks,
      attachTo: options.attachTo,
      sizeLimitKind: options.sizeLimitKind,
    }),
    signal: options.attachTo ? undefined : options.signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Failed to finalize upload.");
  }

  const data = (await res.json()) as { url?: string };
  return { url: data.url ?? null };
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
