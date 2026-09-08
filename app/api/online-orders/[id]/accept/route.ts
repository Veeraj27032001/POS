import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { replaceBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveTax } from "@/lib/billing/resolveTax";
import { unscoped } from "@/lib/db";
import { getOnlineOrderTerminal } from "@/lib/ecommerce/getOnlineOrderTerminal";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { opaqueIdSchema, positiveInt } from "@/lib/validation/common";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class AcceptOrderError extends Error {}

const acceptLineAllocationSchema = z.object({
  warehouseId: opaqueIdSchema,
  quantity: positiveInt,
});

const acceptLineSchema = z.object({
  productId: opaqueIdSchema,
  quantity: positiveInt,
  // Which (possibly cross-store) warehouse(s) this line's quantity comes
  // from — ignored for a non-stock-tracked product. Omit entirely (leave
  // `lines` off the request) to keep every line exactly where it's
  // currently locked.
  allocations: z.array(acceptLineAllocationSchema).default([]),
});

const acceptSchema = z.object({
  lines: z.array(acceptLineSchema).min(1, "At least one line is required.").optional(),
});

interface ResolvedLine {
  productId: string;
  quantity: number;
  allocations: { warehouseId: string; quantity: number }[];
}

// Staff accepts a pending online order from the dedicated Generate Bill
// review page — the invoice is always issued by the order's own store
// (wherever the API credential resolved it to at order time), but for each
// line, staff can choose which store/warehouse the stock actually comes
// from (a line can split across more than one, same as regular billing's
// warehouse split picker). No stock transfer document is ever created: the
// bill's own line allocations point directly at whichever warehouse the
// stock sits in, even when that's a different store than the one billing
// it — the reservation made at order time is simply released and replaced
// by the bill's own (possibly identical) allocation record.
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
    const order = await db.ecommerceOrder.findUnique({
      where: { id },
      include: { items: { include: { locks: true } } },
    });
    if (!order) return apiErrorResponse("not_found", "Online order not found.", 404);
    if (session.user.storeId && order.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Online order not found.", 404);
    }
    if (order.status !== "pending") {
      return apiErrorResponse("bad_request", `Can't accept a ${order.status} order.`, 400);
    }

    const targetStoreId = order.storeId;
    const itemByProduct = new Map(order.items.map((i) => [i.productId, i]));

    const targetLines: ResolvedLine[] = [];
    if (parsed.data.lines) {
      for (const line of parsed.data.lines) {
        if (!itemByProduct.has(line.productId)) {
          return apiErrorResponse("bad_request", "That product isn't part of this order.", 400);
        }
        targetLines.push(line);
      }
    } else {
      for (const item of order.items) {
        targetLines.push({
          productId: item.productId,
          quantity: item.quantity,
          allocations: item.locks.map((l) => ({
            warehouseId: l.warehouseId,
            quantity: l.quantity,
          })),
        });
      }
    }

    const [store, terminal, financialYear] = await Promise.all([
      db.store.findUnique({ where: { id: targetStoreId }, include: { taxEngine: true } }),
      getOnlineOrderTerminal(targetStoreId),
      db.financialYear.findUnique({ where: { id: order.financialYearId } }),
    ]);
    if (!store || !financialYear) {
      return apiErrorResponse("bad_request", "Store or financial year no longer exists.", 400);
    }

    // A warehouse's owning store is always resolved server-side from the
    // warehouse record itself — never trusted from the request.
    const warehouseIds = [
      ...new Set(targetLines.flatMap((l) => l.allocations.map((a) => a.warehouseId))),
    ];
    const warehouses = await db.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true, name: true, isActive: true, isDeleted: true, storeId: true },
    });
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
    for (const warehouseId of warehouseIds) {
      const w = warehouseById.get(warehouseId);
      if (!w || !w.isActive || w.isDeleted || !w.storeId) {
        return apiErrorResponse(
          "bad_request",
          "One of the chosen warehouses is no longer available.",
          400,
        );
      }
    }

    const productIds = [...new Set(targetLines.map((l) => l.productId))];
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    try {
      for (const line of targetLines) {
        const item = itemByProduct.get(line.productId)!;
        const product = productById.get(line.productId);
        if (!product) throw new AcceptOrderError(`${item.productName}: product no longer exists.`);
        if (!product.stockTracked) continue;

        const allocatedTotal = line.allocations.reduce((sum, a) => sum + a.quantity, 0);
        if (allocatedTotal !== line.quantity) {
          throw new AcceptOrderError(
            `${item.productName}: chosen sources add up to ${allocatedTotal}, not ${line.quantity}.`,
          );
        }

        for (const allocation of line.allocations) {
          // This order's own lock already secured some (or all) of this
          // exact warehouse's stock for this exact product — only the
          // amount beyond that needs a fresh availability check. Without
          // this, accepting with the unchanged default split could
          // spuriously fail against a store that's otherwise fully sold
          // out, purely because our own reservation still counts as
          // "blocked" until the transaction below releases it.
          const alreadyLockedHere = item.locks
            .filter((l) => l.warehouseId === allocation.warehouseId)
            .reduce((sum, l) => sum + l.quantity, 0);
          const extraNeeded = Math.max(0, allocation.quantity - alreadyLockedHere);
          if (extraNeeded === 0) continue;

          const levels = await getStockLevels({
            productId: line.productId,
            warehouseId: allocation.warehouseId,
          });
          if (levels.available < extraNeeded) {
            const warehouseName = warehouseById.get(allocation.warehouseId)!.name;
            throw new AcceptOrderError(
              `${item.productName}: only ${levels.available} more available at ${warehouseName}.`,
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof AcceptOrderError) {
        return apiErrorResponse("bad_request", error.message, 400);
      }
      throw error;
    }

    const now = new Date();
    let result;
    try {
      result = await db.$transaction(async (tx) => {
        // Release everything the order arrived holding — whatever gets
        // billed below gets its own fresh allocation record, whether or
        // not the split actually changed.
        for (const item of order.items) {
          for (const lock of item.locks) {
            await tx.stockBlockItem.updateMany({
              where: { stockBlockMainId: lock.stockLockId, status: "active" },
              data: { status: "released", releasedByUserId: session.user.id, releasedAt: now },
            });
          }
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

          if (line.allocations.length > 0) {
            await replaceBillLineAllocations(tx, {
              billLineId: billLine.id,
              allocations: line.allocations.map((a) => ({
                warehouseId: a.warehouseId,
                quantity: a.quantity,
              })),
            });
          }
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
