import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Toggles isActive — deactivating hides a version from the table/download
// button without deleting the row or the uploaded file.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "desktop_releases", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to change releases.", 403);
  }

  const { id } = await params;
  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.desktopAppRelease.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Release not found.", 404);

    const updated = await db.desktopAppRelease.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "desktop_app_release",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
