import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockTransferReceiveSchema } from "@/lib/documents/schemas";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update stock.", 403);
  }
  if (!session.user.storeId) {
    return apiErrorResponse(
      "forbidden",
      "A Super Admin session has no single store — sign in as a store user to receive transfers.",
      403,
    );
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, stockTransferReceiveSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockTransferMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (existing.destinationStoreId !== session.user.storeId) {
      return apiErrorResponse(
        "forbidden",
        "Only the destination store can receive this transfer.",
        403,
      );
    }
    if (existing.status !== "pending") {
      return apiErrorResponse("bad_request", `Can't receive a ${existing.status} transfer.`, 400);
    }

    const transferItems = await db.stockTransferItem.findMany({
      where: { stockTransferMainId: id },
    });
    const transferItemById = new Map(transferItems.map((item) => [item.id, item]));

    for (const submitted of parsed.data.items) {
      const item = transferItemById.get(submitted.itemId);
      if (!item) {
        return apiErrorResponse("bad_request", `Unknown transfer item: ${submitted.itemId}`, 400);
      }
      if (submitted.quantityAccepted + submitted.quantityRejected > item.quantity) {
        return apiErrorResponse(
          "bad_request",
          `${item.productName}: accepted + rejected can't exceed the ${item.quantity} sent.`,
          400,
        );
      }
      const warehouse = await db.warehouse.findUnique({
        where: { id: submitted.destinationWarehouseId },
      });
      if (!warehouse || warehouse.storeId !== session.user.storeId) {
        return apiErrorResponse(
          "bad_request",
          `${item.productName}: select a warehouse belonging to your own store.`,
          400,
        );
      }
    }

    const receivedDate = dateOnlyToUtcMidnight(toDateOnly(parsed.data.receivedDate));

    try {
      const result = await db.$transaction(async (tx) => {
        const items = [];
        for (const submitted of parsed.data.items) {
          items.push(
            await tx.stockTransferItem.update({
              where: { id: submitted.itemId },
              data: {
                destinationWarehouseId: submitted.destinationWarehouseId,
                quantityAccepted: submitted.quantityAccepted,
                quantityRejected: submitted.quantityRejected,
              },
            }),
          );
        }

        const main = await tx.stockTransferMain.update({
          where: { id },
          data: {
            status: "accepted",
            respondedByUserId: session.user.id,
            respondedAt: new Date(),
            receivedDate,
          },
        });

        const blockMain = await tx.stockBlockMain.findFirst({
          where: { sourceType: "pending_transfer", sourceId: id },
        });
        if (blockMain) {
          await tx.stockBlockItem.updateMany({
            where: { stockBlockMainId: blockMain.id, status: "active" },
            data: { status: "released", releasedByUserId: session.user.id, releasedAt: new Date() },
          });
        }

        return { main, items };
      });

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "update",
        entityType: "stock_transfer",
        entityId: id,
        beforeData: existing,
        afterData: result,
      });

      return Response.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        return apiErrorResponse("bad_request", error.message, 400);
      }
      throw error;
    }
  });
}
