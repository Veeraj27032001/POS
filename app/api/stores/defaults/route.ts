import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Any authenticated user can check this — it's read to prefill a new
// customer's country/state at billing time with the store's own location,
// not to browse the Store record (which stays Super-Admin-only).
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  if (!session.user.storeId) {
    return Response.json({ countryId: null, stateId: null });
  }

  const store = await unscoped().store.findUnique({
    where: { id: session.user.storeId },
    select: { countryId: true, stateId: true },
  });

  return Response.json({ countryId: store?.countryId ?? null, stateId: store?.stateId ?? null });
}
