import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { createNotification } from "@/lib/ecommerce/createNotification";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

const rejectSchema = z.object({ reason: z.string().trim().min(1, "A reason is required.") });

// Staff rejects a pending online order: releases every line's stock lock
// (the reservation was the only thing holding it) and notifies the customer.
// No Bill/invoice ever existed for this order, so there's nothing to cancel
// or reverse on the books — that's the entire point of the pending stage.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update online orders.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, rejectSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const order = await db.ecommerceOrder.findUnique({
      where: { id },
      include: { items: { include: { locks: true } } },
    });
    if (!order) return apiErrorResponse("not_found", "Online order not found.", 404);
    if (session.user.storeId && order.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Online order not found.", 404);
    }
    if (order.status !== "pending") {
      return apiErrorResponse("bad_request", `Can't reject a ${order.status} order.`, 400);
    }

    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      for (const item of order.items) {
        for (const lock of item.locks) {
          await tx.stockBlockItem.updateMany({
            where: { stockBlockMainId: lock.stockLockId, status: "active" },
            data: { status: "released", releasedByUserId: session.user.id, releasedAt: now },
          });
        }
      }

      return tx.ecommerceOrder.update({
        where: { id: order.id },
        data: {
          status: "rejected",
          rejectionReason: parsed.data.reason,
          respondedByUserId: session.user.id,
          respondedAt: now,
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: order.storeId,
      action: "update",
      entityType: "ecommerce_order",
      entityId: order.id,
      afterData: { status: "rejected", reason: parsed.data.reason },
    });

    await createNotification({
      customerId: order.customerId,
      eventType: "order_rejected",
      relatedType: "ecommerce_order",
      relatedId: order.id,
    });

    return Response.json(result);
  });
}
