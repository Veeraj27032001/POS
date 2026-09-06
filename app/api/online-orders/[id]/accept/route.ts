import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { replaceBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveTax } from "@/lib/billing/resolveTax";
import { unscoped } from "@/lib/db";
import { getDefaultWarehouseId } from "@/lib/ecommerce/defaultWarehouse";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { opaqueIdSchema, positiveInt } from "@/lib/validation/common";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class AcceptOrderError extends Error {}

const acceptSchema = z.object({
  storeId: opaqueIdSchema.optional(),
  lines: z
    .array(z.object({ productId: opaqueIdSchema, quantity: positiveInt }))
    .min(1, "At least one line is required.")
    .optional(),
});

// Staff accepts a pending online order from the dedicated Generate Bill
// review page — they can switch which store actually bills it and adjust
// quantities (or drop a line) before the real invoice is created. Whatever
// stock the order arrived holding is released and re-checked fresh against
// whatever was actually chosen, so this is never trusting a stale
// reservation — it's a real availability check at bill time, same as any
// other bill.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update online orders.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, acceptSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const order = await db.ecommerceOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) return apiErrorResponse("not_found", "Online order not found.", 404);
    if (session.user.storeId && order.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Online order not found.", 404);
    }
    if (order.status !== "pending") {
      return apiErrorResponse("bad_request", `Can't accept a ${order.status} order.`, 400);
    }

    const targetStoreId = parsed.data.storeId ?? order.storeId;
    const itemByProduct = new Map(order.items.map((i) => [i.productId, i]));
    const targetLines =
      parsed.data.lines ??
      order.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    for (const line of targetLines) {
      if (!itemByProduct.has(line.productId)) {
        return apiErrorResponse("bad_request", "That product isn't part of this order.", 400);
      }
    }

    const [store, terminal, financialYear, warehouseId] = await Promise.all([
      db.store.findUnique({ where: { id: targetStoreId }, include: { taxEngine: true } }),
      db.terminal.findFirst({
        where: { storeId: targetStoreId, isActive: true, isDeleted: false },
        orderBy: { name: "asc" },
      }),
      db.financialYear.findUnique({ where: { id: order.financialYearId } }),
      getDefaultWarehouseId(targetStoreId),
    ]);
    if (!store || !financialYear) {
      return apiErrorResponse("bad_request", "Store or financial year no longer exists.", 400);
    }
    if (!terminal) {
      return apiErrorResponse(
        "bad_request",
        `No active terminal configured for "${store.name}" — contact a Super Admin.`,
        400,
      );
    }
    if (!warehouseId) {
      return apiErrorResponse("bad_request", `"${store.name}" has no active warehouse.`, 400);
    }

    const now = new Date();
    let result;
    try {
      result = await db.$transaction(async (tx) => {
        // Release everything the order arrived holding — whatever gets billed
        // below gets a fresh allocation, whether or not the store/quantities
        // actually changed. Simpler and just as correct as trying to detect
        // "did this line change" case by case.
        for (const item of order.items) {
          if (!item.stockLockId) continue;
          await tx.stockBlockItem.updateMany({
            where: { stockBlockMainId: item.stockLockId, status: "active" },
            data: { status: "released", releasedByUserId: session.user.id, releasedAt: now },
          });
        }

        const { documentNumber } = await allocateDocumentNumber(tx, {
          seriesType: "online_bill",
          storeId: targetStoreId,
          financialYearId: financialYear.id,
        });

        const bill = await tx.bill.create({
          data: {
            documentNumber,
            financialYearId: financialYear.id,
            billType: "online_bill",
            billDate: now,
            storeId: targetStoreId,
            terminalId: terminal.id,
            cashierUserId: session.user.id,
            customerId: order.customerId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            customerAddress: order.customerAddress,
            customerCity: order.customerCity,
            customerTaluk: order.customerTaluk,
            customerStateName: order.customerStateName,
            customerCountryName: order.customerCountryName,
            customerPincode: order.customerPincode,
            status: "completed",
            completedAt: now,
          },
        });

        const customer = await tx.customer.findUnique({ where: { id: order.customerId } });

        for (const line of targetLines) {
          const item = itemByProduct.get(line.productId)!;

          const levels = await getStockLevels({ productId: line.productId, warehouseId });
          if (levels.available < line.quantity) {
            throw new AcceptOrderError(
              `${item.productName}: only ${levels.available} available at ${store.name}.`,
            );
          }

          const lineSubtotal = Number(item.unitPrice) * line.quantity;
          const tax = await resolveTax({
            productId: line.productId,
            lineSubtotal,
            storeTaxEngineCode: store.taxEngine?.code ?? null,
            storeStateId: store.stateId,
            customerStateId: customer?.stateId ?? null,
            excludeTax: false,
          });

          const billLine = await tx.billLine.create({
            data: {
              billId: bill.id,
              productId: line.productId,
              productName: item.productName,
              productBarcode: item.productBarcode,
              quantity: line.quantity,
              unitPrice: item.unitPrice,
              taxBreakdown: tax as never,
              lineTotal: lineSubtotal + tax.taxAmount,
            },
          });

          await replaceBillLineAllocations(tx, {
            billLineId: billLine.id,
            allocations: [{ warehouseId, quantity: line.quantity }],
          });
        }

        await recomputeBillTotals(tx, bill.id);

        return tx.ecommerceOrder.update({
          where: { id: order.id },
          data: {
            storeId: targetStoreId,
            status: "accepted",
            billId: bill.id,
            respondedByUserId: session.user.id,
            respondedAt: now,
          },
        });
      });
    } catch (error) {
      if (error instanceof AcceptOrderError) {
        return apiErrorResponse("bad_request", error.message, 400);
      }
      throw error;
    }

    await writeAuditLog({
      userId: session.user.id,
      storeId: targetStoreId,
      action: "update",
      entityType: "ecommerce_order",
      entityId: order.id,
      afterData: { status: "accepted", billId: result.billId, storeId: targetStoreId },
    });

    return Response.json(result);
  });
}
