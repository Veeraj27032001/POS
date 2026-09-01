import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { getShiftClosingExpected } from "@/lib/shifts/getShiftClosingExpected";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const shift = await db.shift.findUnique({
      where: { id },
      include: {
        terminal: { select: { name: true } },
        cashierUser: { select: { name: true } },
        cashCounts: { include: { denomination: true } },
      },
    });
    if (!shift) return apiErrorResponse("not_found", "Shift not found.", 404);
    if (session.user.storeId && shift.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Shift not found.", 404);
    }

    const computed = shift.status === "open" ? await getShiftClosingExpected(id) : null;

    return Response.json({ ...shift, computedClosingExpected: computed });
  });
}
