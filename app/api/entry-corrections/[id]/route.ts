import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view stock.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const record = await db.stockEntryCorrection.findUnique({ where: { id } });
    if (!record) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && record.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }
    return Response.json(record);
  });
}
