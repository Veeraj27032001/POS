import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockPositiveAdjustmentEditSchema } from "@/lib/documents/schemas";
import { stockPositiveAdjustmentResource } from "@/lib/documents/resources";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return stockPositiveAdjustmentResource.getOne(request, id);
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
  const parsed = await parseJsonOrRespond(request, stockPositiveAdjustmentEditSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockPositiveAdjustmentMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    // Warehouse is fixed on edit — same reasoning as Stock Inward: keeps the
    // "would this go negative" check scoped to a single warehouse.
    const warehouseId = existing.warehouseId;

    const oldItems = await db.stockPositiveAdjustmentItem.findMany({
      where: { stockPositiveAdjustmentMainId: id },
    });
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
      if (newQty >= oldQty) continue;
      const { available } = await getStockLevels({ productId, warehouseId });
      const resultingAvailable = available - oldQty + newQty;
      if (resultingAvailable < 0) {
        return apiErrorResponse(
          "bad_request",
          `Can't reduce this item's quantity that far — it would leave ${resultingAvailable} available at this warehouse (already consumed elsewhere).`,
          400,
        );
      }
    }

    try {
      const result = await db.$transaction(async (tx) => {
        await tx.stockPositiveAdjustmentItem.deleteMany({
          where: { stockPositiveAdjustmentMainId: id },
        });

        const updated = await tx.stockPositiveAdjustmentMain.update({
          where: { id },
          data: {
            warehouseId: parsed.data.warehouseId,
            adjustmentDate: dateOnlyToUtcMidnight(toDateOnly(parsed.data.adjustmentDate)),
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
            await tx.stockPositiveAdjustmentItem.create({
              data: {
                stockPositiveAdjustmentMainId: id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantity: item.quantity,
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
        entityType: "stock_positive_adjustment",
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
    const existing = await db.stockPositiveAdjustmentMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    const items = await db.stockPositiveAdjustmentItem.findMany({
      where: { stockPositiveAdjustmentMainId: id },
    });
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    for (const [productId, qty] of qtyByProduct) {
      const { available } = await getStockLevels({ productId, warehouseId: existing.warehouseId });
      if (available - qty < 0) {
        const item = items.find((i) => i.productId === productId)!;
        return apiErrorResponse(
          "bad_request",
          `Can't delete — ${item.productName} has already had more consumed elsewhere than would remain available.`,
          400,
        );
      }
    }

    await db.stockPositiveAdjustmentMain.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "stock_positive_adjustment",
      entityId: id,
      beforeData: existing,
    });

    return Response.json({ id });
  });
}
