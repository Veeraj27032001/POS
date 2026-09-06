import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { replaceBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveTax } from "@/lib/billing/resolveTax";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Staff accepts a pending online order: this is the moment a real Bill/
// invoice actually gets created — a document number is allocated only now,
// so a rejected order never burns one. Every line's stock is already
// guaranteed reserved (locked at this store's warehouse since the order was
// placed) — accepting just converts that reservation into the permanent
// deduction, same as any other completed bill.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update online orders.", 403);
  }

  const { id } = await params;
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

    const [store, terminal, financialYear] = await Promise.all([
      db.store.findUnique({ where: { id: order.storeId }, include: { taxEngine: true } }),
      db.terminal.findFirst({
        where: { storeId: order.storeId, isActive: true, isDeleted: false },
        orderBy: { name: "asc" },
      }),
      db.financialYear.findUnique({ where: { id: order.financialYearId } }),
    ]);
    if (!store || !financialYear) {
      return apiErrorResponse("bad_request", "Store or financial year no longer exists.", 400);
    }
    if (!terminal) {
      return apiErrorResponse(
        "bad_request",
        "No active terminal configured for this store — contact a Super Admin.",
        400,
      );
    }

    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "online_bill",
        storeId: order.storeId,
        financialYearId: financialYear.id,
      });

      const bill = await tx.bill.create({
        data: {
          documentNumber,
          financialYearId: financialYear.id,
          billType: "online_bill",
          billDate: now,
          storeId: order.storeId,
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

      for (const item of order.items) {
        const lineSubtotal = Number(item.unitPrice) * item.quantity;
        const tax = await resolveTax({
          productId: item.productId,
          lineSubtotal,
          storeTaxEngineCode: store.taxEngine?.code ?? null,
          storeStateId: store.stateId,
          customerStateId: customer?.stateId ?? null,
          excludeTax: false,
        });

        const billLine = await tx.billLine.create({
          data: {
            billId: bill.id,
            productId: item.productId,
            productName: item.productName,
            productBarcode: item.productBarcode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxBreakdown: tax as never,
            lineTotal: lineSubtotal + tax.taxAmount,
          },
        });

        if (!item.stockLockId) continue;

        const lockMain = await tx.stockBlockMain.findUnique({
          where: { id: item.stockLockId },
          include: { items: true },
        });
        const lockItem = lockMain?.items.find(
          (i) => i.productId === item.productId && i.status === "active",
        );
        if (lockMain && lockItem) {
          await replaceBillLineAllocations(tx, {
            billLineId: billLine.id,
            allocations: [{ warehouseId: lockMain.warehouseId, quantity: item.quantity }],
          });
          await tx.stockBlockItem.update({
            where: { id: lockItem.id },
            data: { status: "released", releasedByUserId: session.user.id, releasedAt: now },
          });
        }
      }

      await recomputeBillTotals(tx, bill.id);

      return tx.ecommerceOrder.update({
        where: { id: order.id },
        data: {
          status: "accepted",
          billId: bill.id,
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
      afterData: { status: "accepted", billId: result.billId },
    });

    return Response.json(result);
  });
}
