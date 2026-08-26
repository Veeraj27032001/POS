import { z } from "zod";

import { auth } from "@/auth";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const deleteSchema = z.object({ url: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const parsed = await parseJsonOrRespond(request, deleteSchema);
  if ("response" in parsed) return parsed.response;

  const storage = getStorageAdapter();
  const key = storage.keyFromUrl(parsed.data.url);
  if (!key) {
    return apiErrorResponse(
      "invalid_request",
      "Could not resolve a storage key from that URL.",
      400,
    );
  }

  await storage.remove(key);
  return Response.json({ ok: true });
}
