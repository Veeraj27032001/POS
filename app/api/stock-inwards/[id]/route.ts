import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockInwardEditSchema } from "@/lib/documents/schemas";
import { stockInwardResource } from "@/lib/documents/resources";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return stockInwardResource.getOne(request, id);
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
  const parsed = await parseJsonOrRespond(request, stockInwardEditSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.stockInwardMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }
    if (existing.purchaseOrderId) {
      return apiErrorResponse(
        "bad_request",
        "Can't edit a stock inward that's linked to a product request.",
        400,
      );
    }

    // The warehouse is fixed on edit — moving a receipt to a different
    // warehouse belongs to Stock Transfer, not an edit here. This also
    // keeps the "would this go negative" check to a single warehouse.
    const warehouseId = existing.warehouseId;

    const oldItems = await db.stockInwardItem.findMany({ where: { stockInwardMainId: id } });
    const oldQtyByProduct = new Map<string, number>();
    for (const item of oldItems) {
      oldQtyByProduct.set(
        item.productId,
        (oldQtyByProduct.get(item.productId) ?? 0) + item.quantityAccepted,
      );
    }
    const newQtyByProduct = new Map<string, number>();
    for (const item of parsed.data.items) {
      newQtyByProduct.set(
        item.productId,
        (newQtyByProduct.get(item.productId) ?? 0) + item.quantityAccepted,
      );
    }

    // Checked against the CURRENT, pre-transaction state — reads through
    // getStockLevels()'s own connection, which can't see this
    // transaction's writes yet, so this must run before anything is
    // deleted/created, not after.
    for (const productId of new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()])) {
      const oldQty = oldQtyByProduct.get(productId) ?? 0;
      const newQty = newQtyByProduct.get(productId) ?? 0;
      if (newQty >= oldQty) continue;
      const { available } = await getStockLevels({ productId, warehouseId });
      const resultingAvailable = available - oldQty + newQty;
      if (resultingAvailable < 0) {
        return apiErrorResponse(
          "bad_request",
          `Can't reduce this item's accepted quantity that far — it would leave ${resultingAvailable} available at this warehouse (already consumed by damage or blocks).`,
          400,
        );
      }
    }

    try {
      const result = await db.$transaction(async (tx) => {
        await tx.stockInwardItem.deleteMany({ where: { stockInwardMainId: id } });

        const updated = await tx.stockInwardMain.update({
          where: { id },
          data: {
            supplierId: parsed.data.supplierId ?? null,
            inwardDate: dateOnlyToUtcMidnight(toDateOnly(parsed.data.inwardDate)),
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
            await tx.stockInwardItem.create({
              data: {
                stockInwardMainId: id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantityAccepted: item.quantityAccepted,
                quantityRejected: item.quantityRejected ?? null,
                expiryDate: item.expiryDate
                  ? dateOnlyToUtcMidnight(toDateOnly(item.expiryDate))
                  : null,
                unitCost: item.unitCost ?? null,
              },
            }),
          );
          if (item.unitCost != null) {
            await tx.product.update({
              where: { id: item.productId },
              data: { defaultCostPrice: item.unitCost as never },
            });
          }
        }

        return { main: updated, items };
      });

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "update",
        entityType: "stock_inward",
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
    const existing = await db.stockInwardMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (session.user.storeId && existing.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Record not found.", 404);
    }
    if (existing.purchaseOrderId) {
      return apiErrorResponse(
        "bad_request",
        "Can't delete a stock inward that's linked to a product request.",
        400,
      );
    }

    const items = await db.stockInwardItem.findMany({ where: { stockInwardMainId: id } });
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      qtyByProduct.set(
        item.productId,
        (qtyByProduct.get(item.productId) ?? 0) + item.quantityAccepted,
      );
    }

    // Checked before deleting, for the same reason as the edit path above.
    for (const [productId, qty] of qtyByProduct) {
      const { available } = await getStockLevels({ productId, warehouseId: existing.warehouseId });
      if (available - qty < 0) {
        const item = items.find((i) => i.productId === productId)!;
        return apiErrorResponse(
          "bad_request",
          `Can't delete — ${item.productName} has already had more consumed by damage or blocks than would remain available.`,
          400,
        );
      }
    }

    await db.stockInwardMain.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "stock_inward",
      entityId: id,
      beforeData: existing,
    });

    return Response.json({ id });
  });
}
