import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { isSourceItemType, SOURCE_TYPE_CONFIG } from "@/lib/documents/entryCorrectionSourceTypes";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view stock.", 403);
  }

  const sourceItemType = new URL(request.url).searchParams.get("sourceItemType");
  if (!sourceItemType || !isSourceItemType(sourceItemType)) {
    return apiErrorResponse("bad_request", "Unknown or missing sourceItemType.", 400);
  }

  return withStoreContext(async () => {
    const config = SOURCE_TYPE_CONFIG[sourceItemType];
    const db = unscoped() as unknown as Record<
      string,
      { findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]> }
    >;
    const where = session.user.storeId ? { storeId: session.user.storeId } : {};
    const mains = await db[config.mainDelegate].findMany({
      where,
      select: { id: true, documentNumber: true },
      orderBy: { documentNumber: "desc" },
      take: 500,
    });
    return Response.json({
      data: mains.map((m) => ({ value: m.id, label: m.documentNumber })),
    });
  });
}
