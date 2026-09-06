import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// step7 §1/§2 — "revoke an old one": a distinct action from soft-delete,
// since a revoked credential's row (and its usage history) stays visible on
// the settings page rather than disappearing.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "settings", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update settings.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const existing = await prisma.apiCredential.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      return apiErrorResponse("not_found", "API credential not found.", 404);
    }
    if (existing.revokedAt) {
      return apiErrorResponse("bad_request", "This credential is already revoked.", 400);
    }

    const updated = await prisma.apiCredential.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "api_credential",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
