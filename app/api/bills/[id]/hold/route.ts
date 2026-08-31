import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { blockLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { unscoped } from "@/lib/db";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Park an in-progress bill to serve another customer — lines and customer
// stay exactly as they were (step5 §11). This is also the ONLY point stock
// is actually reserved: a draft bill's lines don't block anything (see the
// comment in app/api/bills/[id]/lines/route.ts), but a held one does, via
// real StockBlock records (one per line's warehouse allocation, sourceType
// "draft_bill_line"). Resuming or completing releases them
// (releaseBillLineAllocations).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft") {
      return apiErrorResponse("bad_request", `Can't hold a ${bill.status} bill.`, 400);
    }

    const lines = await db.billLine.findMany({
      where: { billId: id, status: "active" },
      include: {
        allocations: true,
        product: {
          select: {
            id: true,
            stockTracked: true,
            name: true,
            price: true,
            systemBarcode: true,
            hsnCode: { select: { hsnCode: true } },
          },
        },
      },
    });
    const stockTrackedLines = lines.filter(
      (l) => l.product.stockTracked && l.allocations.length > 0,
    );

    // Validate live availability before committing to any block — a bill
    // can't be held over stock that isn't actually there right now.
    for (const line of stockTrackedLines) {
      for (const alloc of line.allocations) {
        const levels = await getStockLevels({
          productId: line.productId,
          warehouseId: alloc.warehouseId,
        });
        if (levels.available < alloc.quantity) {
          return apiErrorResponse(
            "bad_request",
            `Not enough stock of ${line.product.name} left to hold this bill — recheck quantities.`,
            400,
          );
        }
      }
    }

    let reasonCodeId: string | null = null;
    if (stockTrackedLines.length > 0) {
      const reasonCode = await db.reasonCode.findFirst({
        where: { category: "stock_block", label: "Reserved — pending bill" },
      });
      if (!reasonCode) {
        return apiErrorResponse(
          "bad_request",
          "Missing the 'Reserved — pending bill' reason code — contact a Super Admin.",
          400,
        );
      }
      reasonCodeId = reasonCode.id;
    }

    const updated = await db.$transaction(async (tx) => {
      for (const line of stockTrackedLines) {
        await blockLineAllocations(tx, {
          billLineId: line.id,
          product: line.product,
          storeId: bill.storeId,
          financialYearId: bill.financialYearId,
          userId: session.user.id,
          reasonCodeId: reasonCodeId!,
        });
      }

      return tx.bill.update({
        where: { id },
        data: { status: "held", heldAt: new Date() },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill",
      entityId: id,
      beforeData: bill,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
