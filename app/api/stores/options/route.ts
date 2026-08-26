import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Picking which store a user/terminal/etc. belongs to is a different thing
// from managing the Stores master itself (Super-Admin-only, see the
// `stores` RBAC module) — every user still needs to be able to see store
// names to assign one. A store-scoped viewer only sees their own store; a
// cross-store viewer (storeId null — Super Admin, or an Admin left
// unscoped) sees all of them.
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const stores = await unscoped().store.findMany({
    where: {
      isActive: true,
      ...(session.user.storeId ? { id: session.user.storeId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json({
    data: stores,
    totalRecords: stores.length,
    totalPages: 1,
    page: 1,
    pageSize: stores.length,
  });
}
