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
  if (!hasPermission(session.user.permissions, "products", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view products.", 403);
  }

  const { id } = await params;
  return withStoreContext(async () => {
    const history = await unscoped().productPriceHistory.findMany({
      where: { productId: id },
      orderBy: { changedAt: "desc" },
    });
    return Response.json({ data: history });
  });
}
