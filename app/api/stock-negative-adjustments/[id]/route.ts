import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockNegativeAdjustmentEditSchema } from "@/lib/documents/schemas";
import { stockNegativeAdjustmentResource } from "@/lib/documents/resources";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return stockNegativeAdjustmentResource.getOne(request, id);
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
  const parsed = await parseJsonOrRespond(request, stockNegativeAdjustmentEditSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockNegativeAdjustmentMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    // Editing this document's own quantity down doesn't need re-checking —
    // it only frees up stock. An increase (or a warehouse change, which
    // moves the effect to a warehouse this item never subtracted from) is
    // checked against what's available once this item's own old
    // contribution to that figure is accounted for.
    const oldItems = await db.stockNegativeAdjustmentItem.findMany({
      where: { stockNegativeAdjustmentMainId: id },
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
    const sameWarehouse = parsed.data.warehouseId === existing.warehouseId;

    for (const productId of new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()])) {
      const oldQty = sameWarehouse ? (oldQtyByProduct.get(productId) ?? 0) : 0;
      const newQty = newQtyByProduct.get(productId) ?? 0;
      if (newQty <= oldQty) continue;
      const { available } = await getStockLevels({
        productId,
        warehouseId: parsed.data.warehouseId,
      });
      if (available + oldQty - newQty < 0) {
        return apiErrorResponse(
          "bad_request",
          `Cannot reduce ${newQty} — only ${available + oldQty} available at this warehouse.`,
          400,
        );
      }
    }

    try {
      const result = await db.$transaction(async (tx) => {
        await tx.stockNegativeAdjustmentItem.deleteMany({
          where: { stockNegativeAdjustmentMainId: id },
        });

        const updated = await tx.stockNegativeAdjustmentMain.update({
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
            await tx.stockNegativeAdjustmentItem.create({
              data: {
                stockNegativeAdjustmentMainId: id,
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
        entityType: "stock_negative_adjustment",
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
    const existing = await db.stockNegativeAdjustmentMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }

    await db.stockNegativeAdjustmentMain.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "stock_negative_adjustment",
      entityId: id,
      beforeData: existing,
    });

    return Response.json({ id });
  });
}
