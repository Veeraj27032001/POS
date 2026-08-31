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

  const url = new URL(request.url);
  const sourceItemType = url.searchParams.get("sourceItemType");
  const mainId = url.searchParams.get("mainId");
  if (!sourceItemType || !isSourceItemType(sourceItemType) || !mainId) {
    return apiErrorResponse("bad_request", "Missing or unknown sourceItemType/mainId.", 400);
  }

  return withStoreContext(async () => {
    const config = SOURCE_TYPE_CONFIG[sourceItemType];
    const db = unscoped() as unknown as Record<
      string,
      {
        findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
        findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
      }
    >;

    const main = await db[config.mainDelegate].findUnique({ where: { id: mainId } });
    if (!main || (session.user.storeId && main.storeId !== session.user.storeId)) {
      return apiErrorResponse("not_found", "Document not found.", 404);
    }

    const items = await db[config.itemDelegate].findMany({
      where: { [config.itemMainIdField]: mainId },
    });
    return Response.json({
      data: items.map((item) => ({
        value: item.id as string,
        label: `${item.productName as string} — ${config.fieldLabel}: ${item[config.correctableField]}`,
        currentValue: item[config.correctableField] as number,
      })),
    });
  });
}
