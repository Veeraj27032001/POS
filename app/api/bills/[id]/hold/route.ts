import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  blockLineAllocations,
  releaseBillLineAllocations,
} from "@/lib/billing/allocateBillLineStock";
import { getSelfBlockedByWarehouse } from "@/lib/billing/getSelfBlockedByWarehouse";
import { unscoped } from "@/lib/db";
import { swapTempBillNumberPrefix } from "@/lib/numbering/formatTempBillNumber";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Park an in-progress bill — the only point stock actually gets reserved
// (draft blocks nothing; resume doesn't release either, only Cancel/Create
// does — see resume/route.ts). Hold is idempotent: releases-then-recreates
// each line's block in one transaction, so re-holding unchanged is a no-op.
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

    // Add back this bill's own existing block before comparing, so a re-hold
    // doesn't fail against its own reservation.
    const checks = stockTrackedLines.flatMap((line) =>
      line.allocations.map((alloc) => ({ line, alloc })),
    );
    const results = await Promise.all(
      checks.map(async ({ line, alloc }) => {
        const [levels, selfBlocked] = await Promise.all([
          getStockLevels({ productId: line.productId, warehouseId: alloc.warehouseId }),
          getSelfBlockedByWarehouse(id, line.productId),
        ]);
        const effectiveAvailable = levels.available + (selfBlocked.get(alloc.warehouseId) ?? 0);
        return { line, alloc, effectiveAvailable };
      }),
    );
    const shortfall = results.find((r) => r.effectiveAvailable < r.alloc.quantity);
    if (shortfall) {
      return apiErrorResponse(
        "bad_request",
        `Not enough stock of ${shortfall.line.product.name} left to hold this bill — recheck quantities.`,
        400,
      );
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
        await releaseBillLineAllocations(tx, line.id, session.user.id);
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
        data: {
          status: "held",
          heldAt: new Date(),
          documentNumber: swapTempBillNumberPrefix(bill.documentNumber, "held"),
        },
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
