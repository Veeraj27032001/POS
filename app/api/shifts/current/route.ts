import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const terminalId = new URL(request.url).searchParams.get("terminalId");
  if (!terminalId) {
    return apiErrorResponse("bad_request", "terminalId is required.", 400);
  }

  return withStoreContext(async () => {
    const db = unscoped();
    const shift = await db.shift.findFirst({
      where: { terminalId, cashierUserId: session.user.id, status: "open" },
      select: { id: true, documentNumber: true, openingFloat: true, openedAt: true },
    });
    return Response.json({ shift });
  });
}
