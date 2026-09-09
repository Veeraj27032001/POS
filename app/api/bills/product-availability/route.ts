import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { getStoreWideAvailable } from "@/lib/billing/getStoreWideAvailable";
import { getSelfBlockedByWarehouse } from "@/lib/billing/getSelfBlockedByWarehouse";
import { getSelfSoldByWarehouse } from "@/lib/billing/getSelfSoldByWarehouse";
import { unscoped } from "@/lib/db";
import { opaqueIdSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

const schema = z.object({
  productIds: z.array(opaqueIdSchema).max(50),
  billId: opaqueIdSchema.optional().nullable(),
});

// Store-wide available quantity for a handful of products at once — used
// to show green/red stock status on billing's product search results
// before anything is added to the cart. Read-only, nothing persisted.
export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }
  if (!session.user.storeId) {
    return Response.json({ availability: [] });
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;
  const { billId } = parsed.data;

  return withStoreContext(async () => {
    const billStatus = billId
      ? (await unscoped().bill.findUnique({ where: { id: billId }, select: { status: true } }))
          ?.status
      : null;

    const availability = await Promise.all(
      parsed.data.productIds.map(async (productId) => {
        const available = await getStoreWideAvailable(session.user.storeId!, productId);
        const selfMap =
          billId && billStatus === "held"
            ? await getSelfBlockedByWarehouse(billId, productId)
            : billId && billStatus === "completed"
              ? await getSelfSoldByWarehouse(billId, productId)
              : null;
        const self = selfMap ? Array.from(selfMap.values()).reduce((sum, qty) => sum + qty, 0) : 0;
        return { productId, available: available + self };
      }),
    );
    return Response.json({ availability });
  });
}
