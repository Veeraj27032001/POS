import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { auth } from "@/auth";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { env } from "@/lib/config/env";
import { unscoped } from "@/lib/db";
import { DESKTOP_RELEASE_MAX_UPLOAD_MB } from "@/lib/upload/uploadFile";
import { completeUploadSchema } from "@/lib/upload/schemas";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

function sanitizeExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})$/.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : "";
}

const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 80;
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function optimizeIfImage(
  body: Buffer,
  contentType: string,
  key: string,
): Promise<{ body: Buffer; contentType: string; key: string }> {
  if (!OPTIMIZABLE_IMAGE_TYPES.has(contentType)) {
    return { body, contentType, key };
  }
  try {
    const { default: sharp } = await import("sharp");
    const optimized = await sharp(body)
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return {
      body: optimized,
      contentType: "image/webp",
      key: key.replace(/\.[a-zA-Z0-9]{1,10}$/, "") + ".webp",
    };
  } catch (error) {
    console.error("Image optimization failed; storing original.", error);
    return { body, contentType, key };
  }
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
  const { filename, contentType, totalChunks, attachTo, sizeLimitKind } = parsed.data;
  const maxSizeMB =
    sizeLimitKind === "desktop-release"
      ? DESKTOP_RELEASE_MAX_UPLOAD_MB
      : env().MAX_UPLOAD_FILE_SIZE_MB;

  const storage = getStorageAdapter();
  const chunkKeys = Array.from({ length: totalChunks }, (_, i) => `_tmp/${uploadId}/${i}`);
  const key = `${session.user.id}/${randomUUID()}${sanitizeExtension(filename)}`;

  async function reassembleAndStore(): Promise<{ url: string } | { tooLarge: true }> {
    const chunks: Buffer[] = [];
    for (const chunkKey of chunkKeys) {
      chunks.push(await storage.get(chunkKey));
    }
    const assembled = Buffer.concat(chunks);

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (assembled.length > maxBytes) {
      await Promise.all(chunkKeys.map((chunkKey) => storage.remove(chunkKey)));
      return { tooLarge: true };
    }

    const optimized = await optimizeIfImage(assembled, contentType, key);

    const { url } = await storage.put(optimized);
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
        `File exceeds the ${maxSizeMB} MB upload limit.`,
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
  //
  // The pending row is created here (before responding) so it's guaranteed
  // to exist by the time the client's request resolves — any device or
  // session querying this product afterward can see "still processing" is
  // real, not just a client-side guess that would vanish on a refresh or a
  // different device.
  const db = unscoped();
  const pendingRow = await db.pendingMediaUpload.create({
    data: { productId: attachTo.id, field: attachTo.field },
    select: { id: true },
  });

  after(async () => {
    try {
      const result = await reassembleAndStore();
      if ("tooLarge" in result) {
        console.error(
          `Upload ${uploadId}: assembled file exceeds the ${maxSizeMB} MB limit; discarded.`,
        );
        return;
      }
      if (attachTo.field === "images") {
        await db.$executeRaw`UPDATE products SET images = array_append(images, ${result.url}) WHERE id = ${attachTo.id}`;
      } else {
        await db.$executeRaw`UPDATE products SET videos = array_append(videos, ${result.url}) WHERE id = ${attachTo.id}`;
      }
    } catch (error) {
      console.error(`Upload ${uploadId}: background processing failed.`, error);
    } finally {
      await db.pendingMediaUpload.delete({ where: { id: pendingRow.id } }).catch(() => {});
    }
  });

  return Response.json({ status: "processing" }, { status: 202 });
}
