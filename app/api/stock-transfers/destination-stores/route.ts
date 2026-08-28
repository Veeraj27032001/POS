import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Lightly gated, like stores/options — picking a transfer's destination
// store means seeing OTHER stores by name, which the "stores" RBAC module
// (Super-Admin-only) otherwise wouldn't allow a regular store user to do.
// Name only, no address/GSTIN/other details, and never the caller's own
// store (that's a same-store transfer, a different flow entirely).
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const stores = await unscoped().store.findMany({
    where: {
      isActive: true,
      ...(session.user.storeId ? { id: { not: session.user.storeId } } : {}),
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
