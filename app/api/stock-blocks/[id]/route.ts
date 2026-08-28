import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockBlockEditSchema } from "@/lib/documents/schemas";
import { stockBlockResource } from "@/lib/documents/resources";
import { writeAuditLog } from "@/lib/security/audit";
import { opaqueIdSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return stockBlockResource.getOne(request, id);
}

interface StockBlockItemReader {
  stockBlockItem: {
    findMany(args: { where: Record<string, unknown> }): Promise<{ status: string }[]>;
  };
}

async function assertEditable(db: StockBlockItemReader, id: string) {
  const items = await db.stockBlockItem.findMany({ where: { stockBlockMainId: id } });
  if (items.some((item) => item.status === "released")) {
    throw new ValidationError(
      "Can't edit or delete this block — one or more items have already been released.",
    );
  }
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
  const parsed = await parseJsonOrRespond(request, stockBlockEditSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockBlockMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    try {
      const result = await db.$transaction(async (tx) => {
        await assertEditable(tx, id);
        await tx.stockBlockItem.deleteMany({ where: { stockBlockMainId: id } });

        const updated = await tx.stockBlockMain.update({
          where: { id },
          data: {
            warehouseId: parsed.data.warehouseId,
            blockedAt: dateOnlyToUtcMidnight(toDateOnly(parsed.data.blockedDate)),
            reviewByDate: parsed.data.reviewByDate
              ? dateOnlyToUtcMidnight(toDateOnly(parsed.data.reviewByDate))
              : null,
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
            await tx.stockBlockItem.create({
              data: {
                stockBlockMainId: id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantityBlocked: item.quantityBlocked,
                reasonCodeId: item.reasonCodeId,
              },
            }),
          );
        }

        return { main: updated, items };
      });

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "update",
        entityType: "stock_block",
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
    const existing = await db.stockBlockMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    try {
      await assertEditable(db, id);
    } catch (error) {
      if (error instanceof ValidationError) {
        return apiErrorResponse("bad_request", error.message, 400);
      }
      throw error;
    }

    await db.stockBlockMain.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "stock_block",
      entityId: id,
      beforeData: existing,
    });

    return Response.json({ id });
  });
}

const releaseItemSchema = z.object({ itemId: opaqueIdSchema });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update stock.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, releaseItemSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const main = await db.stockBlockMain.findUnique({ where: { id } });
    if (!main) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && main.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    const existing = await db.stockBlockItem.findUnique({ where: { id: parsed.data.itemId } });
    if (!existing || existing.stockBlockMainId !== id) {
      return apiErrorResponse("not_found", "Block item not found.", 404);
    }
    if (existing.status === "released") {
      return apiErrorResponse("bad_request", "This item is already released.", 400);
    }

    const updated = await db.stockBlockItem.update({
      where: { id: parsed.data.itemId },
      data: {
        status: "released",
        releasedByUserId: session.user.id,
        releasedAt: new Date(),
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "stock_block_item",
      entityId: parsed.data.itemId,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
