import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { runWithStoreContext, unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";

// step7 §5 — DELETE /v1/ecommerce/stock-lock/{id}: releases a lock made via
// POST /v1/ecommerce/stock-lock — abandoned cart, failed checkout.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const { id } = await params;
  const db = unscoped();

  const main = await db.stockBlockMain.findUnique({ where: { id } });
  if (!main || main.storeId !== auth.storeId || main.sourceType !== "ecommerce_order") {
    return apiErrorResponse("not_found", "Stock lock not found.", 404);
  }

  const now = new Date();
  await db.stockBlockItem.updateMany({
    where: { stockBlockMainId: main.id, status: "active" },
    data: { status: "released", releasedByUserId: auth.createdByUserId, releasedAt: now },
  });

  await runWithStoreContext({ storeId: auth.storeId, userId: auth.createdByUserId }, () =>
    writeAuditLog({
      userId: auth.createdByUserId,
      storeId: auth.storeId,
      action: "update",
      entityType: "stock_block",
      entityId: main.id,
      afterData: { released: true },
    }),
  );

  return Response.json({ released: true });
}
