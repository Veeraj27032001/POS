import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Spec: "past review_by_date (or, if that wasn't set, active longer than a
// configurable default)". No settings UI exists for that default yet, so
// it's a fixed constant here — a block with no reviewByDate is stale once
// it's been active for more than a week.
const DEFAULT_STALE_AFTER_DAYS = 7;

export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view stock.", 403);
  }

  return withStoreContext(async () => {
    const now = new Date();
    const defaultCutoff = new Date(now.getTime() - DEFAULT_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const storeWhere = session.user.storeId ? { storeId: session.user.storeId } : {};

    const items = await unscoped().stockBlockItem.findMany({
      where: {
        status: "active",
        stockBlockMain: {
          ...storeWhere,
          OR: [
            { reviewByDate: { lt: now } },
            { reviewByDate: null, blockedAt: { lt: defaultCutoff } },
          ],
        },
      },
      include: {
        stockBlockMain: {
          select: { documentNumber: true, warehouseId: true, reviewByDate: true, blockedAt: true },
        },
      },
      orderBy: { id: "desc" },
    });

    return Response.json({ data: items });
  });
}
