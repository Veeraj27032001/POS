import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Selecting which storage location stock sits in is a different thing from
// managing the Storage master itself (Super-Admin-only, see the `warehouses`
// RBAC module). Every stock document and billing allocation needs the names,
// so this stays open to any signed-in user — but only ever returns their own
// store's locations, and only id + name.
export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  // A store-scoped user is pinned to their own store whatever they ask for.
  // A cross-store viewer (Super Admin) may narrow to one store — the reports
  // do this once a store card is picked.
  const requestedStoreId = new URL(request.url).searchParams.get("storeId");
  const storeId = session.user.storeId ?? requestedStoreId;

  const warehouses = await unscoped().warehouse.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json({
    data: warehouses,
    totalRecords: warehouses.length,
    totalPages: 1,
    page: 1,
    pageSize: warehouses.length,
  });
}
