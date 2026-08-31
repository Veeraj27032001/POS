import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockTransferEditSchema, stockTransferRespondSchema } from "@/lib/documents/schemas";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

async function releaseTransferBlocks(
  tx: Prisma.TransactionClient,
  transferId: string,
  userId: string,
) {
  const blockMain = await tx.stockBlockMain.findFirst({
    where: { sourceType: "pending_transfer", sourceId: transferId },
  });
  if (!blockMain) return;
  await tx.stockBlockItem.updateMany({
    where: { stockBlockMainId: blockMain.id, status: "active" },
    data: { status: "released", releasedByUserId: userId, releasedAt: new Date() },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view stock.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const main = await db.stockTransferMain.findUnique({ where: { id } });
    if (!main) return apiErrorResponse("not_found", "Record not found.", 404);
    if (
      session.user.storeId &&
      main.storeId !== session.user.storeId &&
      main.destinationStoreId !== session.user.storeId
    ) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    const items = await db.stockTransferItem.findMany({ where: { stockTransferMainId: id } });
    return Response.json({ ...main, items });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update stock.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, stockTransferRespondSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockTransferMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (existing.status !== "pending") {
      return apiErrorResponse("bad_request", `Can't act on a ${existing.status} transfer.`, 400);
    }

    if (parsed.data.action === "cancel") {
      if (session.user.storeId && existing.storeId !== session.user.storeId) {
        return apiErrorResponse(
          "forbidden",
          "Only the requesting store can cancel this transfer.",
          403,
        );
      }
    } else {
      if (session.user.storeId && existing.destinationStoreId !== session.user.storeId) {
        return apiErrorResponse(
          "forbidden",
          "Only the destination store can reject this transfer.",
          403,
        );
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.stockTransferMain.update({
        where: { id },
        data:
          parsed.data.action === "cancel"
            ? { status: "cancelled", cancelledAt: new Date() }
            : {
                status: "rejected",
                respondedByUserId: session.user.id,
                respondedAt: new Date(),
              },
      });
      await releaseTransferBlocks(tx, id, session.user.id);
      return result;
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "stock_transfer",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update stock.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, stockTransferEditSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockTransferMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }
    if (existing.status !== "pending") {
      return apiErrorResponse(
        "bad_request",
        "Can only edit a transfer while it's still pending.",
        400,
      );
    }

    // This transfer's own pending quantity is already subtracted from
    // `available` via its active source block — add it back per product
    // before checking the new quantity, or a same-or-smaller edit would be
    // wrongly rejected.
    const oldItems = await db.stockTransferItem.findMany({ where: { stockTransferMainId: id } });
    const oldQtyByProduct = new Map<string, number>();
    for (const item of oldItems) {
      oldQtyByProduct.set(
        item.productId,
        (oldQtyByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const newQtyByProduct = new Map<string, number>();
    for (const item of parsed.data.items) {
      newQtyByProduct.set(
        item.productId,
        (newQtyByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    for (const productId of new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()])) {
      const oldQty = oldQtyByProduct.get(productId) ?? 0;
      const newQty = newQtyByProduct.get(productId) ?? 0;
      if (newQty <= oldQty) continue;
      const { available } = await getStockLevels({
        productId,
        warehouseId: existing.sourceWarehouseId,
      });
      if (available + oldQty - newQty < 0) {
        return apiErrorResponse(
          "bad_request",
          `Cannot transfer ${newQty} — only ${available + oldQty} available at the source warehouse.`,
          400,
        );
      }
    }

    try {
      const result = await db.$transaction(async (tx) => {
        await tx.stockTransferItem.deleteMany({ where: { stockTransferMainId: id } });

        const updated = await tx.stockTransferMain.update({
          where: { id },
          data: {
            requestedAt: dateOnlyToUtcMidnight(toDateOnly(parsed.data.transferDate)),
            notes: parsed.data.notes ?? null,
          },
        });

        const products = await tx.product.findMany({
          where: { id: { in: parsed.data.items.map((item) => item.productId) } },
          include: { hsnCode: { select: { hsnCode: true } } },
        });
        const productById = new Map(products.map((p) => [p.id, p]));

        const items = [];
        for (const item of parsed.data.items) {
          const product = productById.get(item.productId);
          if (!product) throw new ValidationError(`Unknown product: ${item.productId}`);
          items.push(
            await tx.stockTransferItem.create({
              data: {
                stockTransferMainId: id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantity: item.quantity,
              },
            }),
          );
        }

        // The stock block reserving this at the source must match the new
        // quantities — replace its items the same way as the transfer's own.
        const blockMain = await tx.stockBlockMain.findFirst({
          where: { sourceType: "pending_transfer", sourceId: id },
        });
        if (blockMain) {
          await tx.stockBlockItem.deleteMany({ where: { stockBlockMainId: blockMain.id } });
          const reason = await tx.reasonCode.findFirst({
            where: { category: "stock_block", label: "Reserved — pending transfer" },
          });
          if (!reason) {
            throw new ValidationError("Missing the 'Reserved — pending transfer' reason code.");
          }
          for (const item of parsed.data.items) {
            const product = productById.get(item.productId)!;
            await tx.stockBlockItem.create({
              data: {
                stockBlockMainId: blockMain.id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantityBlocked: item.quantity,
                reasonCodeId: reason.id,
              },
            });
          }
        }

        return { main: updated, items };
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "delete")) {
    return apiErrorResponse("forbidden", "You don't have permission to delete stock records.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockTransferMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }
    if (existing.status === "accepted") {
      return apiErrorResponse(
        "bad_request",
        "Can't delete a transfer that's already been received.",
        400,
      );
    }

    await db.$transaction(async (tx) => {
      await releaseTransferBlocks(tx, id, session.user.id);
      await tx.stockTransferMain.delete({ where: { id } });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "stock_transfer",
      entityId: id,
      beforeData: existing,
    });

    return Response.json({ id });
  });
}
