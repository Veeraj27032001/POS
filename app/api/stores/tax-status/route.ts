import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Any authenticated user can check this — the banner it powers needs to
// reach every role, not just the Super Admin who can act on it. A Super
// Admin session (storeId null, not scoped to one store) always reads as
// configured here; they see per-store status on the Tax Engine page itself.
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  if (!session.user.storeId) {
    return Response.json({ configured: true });
  }

  const store = await unscoped().store.findUnique({
    where: { id: session.user.storeId },
    select: { taxEngineId: true },
  });

  return Response.json({ configured: Boolean(store?.taxEngineId) });
}
