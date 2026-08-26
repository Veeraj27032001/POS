import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { auth } from "@/auth";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { env } from "@/lib/config/env";
import { unscoped } from "@/lib/db";
import { completeUploadSchema } from "@/lib/upload/schemas";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

function sanitizeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const { uploadId } = await params;
  if (!/^[a-zA-Z0-9-]+$/.test(uploadId)) {
    return apiErrorResponse("invalid_request", "Invalid upload id.", 400);
  }

  const parsed = await parseJsonOrRespond(request, completeUploadSchema);
  if ("response" in parsed) return parsed.response;
  const { filename, contentType, totalChunks, attachTo } = parsed.data;

  const storage = getStorageAdapter();
  const chunkKeys = Array.from({ length: totalChunks }, (_, i) => `_tmp/${uploadId}/${i}`);
  const key = `${session.user.id}/${randomUUID()}${sanitizeExtension(filename)}`;

  async function reassembleAndStore(): Promise<{ url: string } | { tooLarge: true }> {
    const chunks: Buffer[] = [];
    for (const chunkKey of chunkKeys) {
      chunks.push(await storage.get(chunkKey));
    }
    const body = Buffer.concat(chunks);

    const maxBytes = env().MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
    if (body.length > maxBytes) {
      await Promise.all(chunkKeys.map((chunkKey) => storage.remove(chunkKey)));
      return { tooLarge: true };
    }

    const { url } = await storage.put({ key, contentType, body });
    await Promise.all(chunkKeys.map((chunkKey) => storage.remove(chunkKey)));
    return { url };
  }

  if (!attachTo) {
    // No record to attach to — caller (e.g. a plain FileUploadField) wants
    // the URL back directly, so finish synchronously as before.
    let result: Awaited<ReturnType<typeof reassembleAndStore>>;
    try {
      result = await reassembleAndStore();
    } catch {
      return apiErrorResponse(
        "incomplete_upload",
        "Not all chunks were received. Retry the missing chunk(s) before completing.",
        400,
      );
    }
    if ("tooLarge" in result) {
      return apiErrorResponse(
        "file_too_large",
        `File exceeds the ${env().MAX_UPLOAD_FILE_SIZE_MB} MB upload limit.`,
        413,
      );
    }
    return Response.json({ url: result.url });
  }

  // attachTo given: every chunk PUT already succeeded before the client
  // called this route, so reassembly is expected to work. Running it in
  // `after()` means the response below returns immediately — the browser
  // tab doesn't need to stay open for the merge, storage upload, and
  // attaching the URL to the record to finish; that all happens
  // server-side regardless of whether the client is still connected.
  after(async () => {
    try {
      const result = await reassembleAndStore();
      if ("tooLarge" in result) {
        console.error(
          `Upload ${uploadId}: assembled file exceeds the ${env().MAX_UPLOAD_FILE_SIZE_MB} MB limit; discarded.`,
        );
        return;
      }
      const db = unscoped();
      if (attachTo.field === "images") {
        await db.$executeRaw`UPDATE products SET images = array_append(images, ${result.url}) WHERE id = ${attachTo.id}`;
      } else {
        await db.$executeRaw`UPDATE products SET videos = array_append(videos, ${result.url}) WHERE id = ${attachTo.id}`;
      }
    } catch (error) {
      console.error(`Upload ${uploadId}: background processing failed.`, error);
    }
  });

  return Response.json({ status: "processing" }, { status: 202 });
}
