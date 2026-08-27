import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { copyNumberingSeriesToStores } from "@/lib/masters/copyNumberingSeries";
import { numberingSeriesCopyToAllStoresSchema } from "@/lib/masters/schemas";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "numbering_series", "create")) {
    return apiErrorResponse(
      "forbidden",
      "You don't have permission to create numbering series.",
      403,
    );
  }

  const parsed = await parseJsonOrRespond(request, numberingSeriesCopyToAllStoresSchema);
  if ("response" in parsed) return parsed.response;
  const { sourceStoreId } = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const sourceCount = await db.numberingSeries.count({
      where: { storeId: sourceStoreId, isDeleted: false },
    });
    if (sourceCount === 0) {
      return apiErrorResponse(
        "not_found",
        "The source store has no numbering series to copy.",
        404,
      );
    }

    const targetStores = await db.store.findMany({
      where: { id: { not: sourceStoreId }, isDeleted: false, isActive: true },
      select: { id: true },
    });
    if (targetStores.length === 0) {
      return apiErrorResponse("not_found", "There are no other stores to copy series to.", 404);
    }

    const { copiedCount } = await copyNumberingSeriesToStores(
      sourceStoreId,
      targetStores.map((s) => s.id),
    );

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "numbering_series",
      entityId: sourceStoreId,
      afterData: { copiedCount, targetStoreCount: targetStores.length },
    });

    return Response.json({ copiedCount, targetStoreCount: targetStores.length });
  });
}
