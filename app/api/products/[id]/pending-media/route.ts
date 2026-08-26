import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Safety net only — normal rows live for seconds (the merge is fast) and
// get deleted the moment it finishes. This just stops a row from showing
// "processing" forever in the rare case cleanup itself failed (a crash
// mid-request, etc).
const STALE_MS = 10 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const { id } = await params;
  const db = unscoped();

  await db.pendingMediaUpload.deleteMany({
    where: { productId: id, createdAt: { lt: new Date(Date.now() - STALE_MS) } },
  });

  const pending = await db.pendingMediaUpload.findMany({
    where: { productId: id },
    select: { id: true, field: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ pending });
}
