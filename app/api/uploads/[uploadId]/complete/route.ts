import { randomUUID } from "node:crypto";

import { auth } from "@/auth";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { env } from "@/lib/config/env";
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
  const { filename, contentType, totalChunks } = parsed.data;

  const storage = getStorageAdapter();
  const chunkKeys = Array.from({ length: totalChunks }, (_, i) => `_tmp/${uploadId}/${i}`);
  const chunks: Buffer[] = [];
  try {
    for (const chunkKey of chunkKeys) {
      chunks.push(await storage.get(chunkKey));
    }
  } catch {
    return apiErrorResponse(
      "incomplete_upload",
      "Not all chunks were received. Retry the missing chunk(s) before completing.",
      400,
    );
  }

  const body = Buffer.concat(chunks);
  const maxBytes = env().MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
  if (body.length > maxBytes) {
    await Promise.all(chunkKeys.map((chunkKey) => storage.remove(chunkKey)));
    return apiErrorResponse(
      "file_too_large",
      `File exceeds the ${env().MAX_UPLOAD_FILE_SIZE_MB} MB upload limit.`,
      413,
    );
  }

  const key = `${session.user.id}/${randomUUID()}${sanitizeExtension(filename)}`;
  const { url } = await storage.put({ key, contentType, body });

  await Promise.all(chunkKeys.map((chunkKey) => storage.remove(chunkKey)));

  return Response.json({ url });
}
