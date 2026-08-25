import { auth } from "@/auth";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { apiErrorResponse } from "@/lib/validation/response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uploadId: string; index: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const { uploadId, index } = await params;
  if (!/^[a-zA-Z0-9-]+$/.test(uploadId) || !/^\d+$/.test(index)) {
    return apiErrorResponse("invalid_request", "Invalid upload id or chunk index.", 400);
  }

  const body = Buffer.from(await request.arrayBuffer());
  await getStorageAdapter().put({
    key: `_tmp/${uploadId}/${index}`,
    contentType: "application/octet-stream",
    body,
  });

  return Response.json({ received: body.length });
}
