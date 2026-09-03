import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { releaseBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { getSelfBlockedByWarehouse } from "@/lib/billing/getSelfBlockedByWarehouse";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Finalizes a bill — payments must already cover the grand total (§12),
// a Credit Bill just requires a customer to be attached, and the receipt is
// snapshotted (§11, step3 §7's fidelity rule). Stock isn't
// explicitly deducted here: getStockLevels() already subtracts active Bill
// Line Warehouse Allocations on a `completed` bill, so flipping status is
// the deduction. A held bill's stock was already hard-checked at Hold time
// (and stays reserved the whole time, so nothing could invalidate it) —
// but a bill going straight from draft to complete never went through
// that check (draft only ever warns, never blocks), so it's re-verified
// here for real before finalizing either way.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        lines: {
          where: { status: "active" },
          include: { allocations: true, product: { select: { stockTracked: true, name: true } } },
        },
        store: true,
        customer: true,
      },
    });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft" && bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't complete a ${bill.status} bill.`, 400);
    }
    if (bill.lines.length === 0) {
      return apiErrorResponse("bad_request", "Add at least one item before completing.", 400);
    }

    const body = await request.json().catch(() => ({}));
    const allowUnpaidForGateway = body?.allowUnpaidForGateway === true;

    const payments = await db.billPayment.aggregate({
      _sum: { amount: true },
      where: { billId: id, status: "success" },
    });
    const totalPaid = Number(payments._sum.amount ?? 0);
    if (
      bill.billType !== "credit_bill" &&
      !allowUnpaidForGateway &&
      totalPaid < Number(bill.grandTotal)
    ) {
      return apiErrorResponse(
        "bad_request",
        `Payments total ${totalPaid} — ${(Number(bill.grandTotal) - totalPaid).toFixed(2)} still due.`,
        400,
      );
    }

    const stockTrackedLines = bill.lines.filter(
      (l) => l.product.stockTracked && l.allocations.length > 0,
    );
    const checks = stockTrackedLines.flatMap((line) =>
      line.allocations.map((alloc) => ({ line, alloc })),
    );
    const stockResults = await Promise.all(
      checks.map(async ({ line, alloc }) => {
        const [levels, selfBlocked] = await Promise.all([
          getStockLevels({ productId: line.productId, warehouseId: alloc.warehouseId }),
          getSelfBlockedByWarehouse(id, line.productId),
        ]);
        const effectiveAvailable = levels.available + (selfBlocked.get(alloc.warehouseId) ?? 0);
        return { line, alloc, effectiveAvailable };
      }),
    );
    const shortfall = stockResults.find((r) => r.effectiveAvailable < r.alloc.quantity);
    if (shortfall) {
      return apiErrorResponse(
        "bad_request",
        `Not enough stock of ${shortfall.line.product.name} to complete this bill — recheck quantities.`,
        400,
      );
    }

    if (bill.billType === "credit_bill" && !bill.customer) {
      return apiErrorResponse("bad_request", "A Credit Bill requires a customer.", 400);
    }

    const receiptSnapshot = {
      storeName: bill.store.name,
      gstin: bill.store.gstin,
      logoUrl: bill.store.logoUrl,
      headerText: bill.store.receiptHeaderText,
      footerText: bill.store.receiptFooterText,
      returnPolicyText: bill.store.returnPolicyText,
    };

    const result = await db.$transaction(async (tx) => {
      for (const line of bill.lines) {
        await releaseBillLineAllocations(tx, line.id, session.user.id);
      }

      // The one point a cash/credit bill ever touches the real numbering
      // series — draft/held only ever used a temp number (see
      // app/api/bills/route.ts), so this is the first real allocation.
      const realDocumentNumber =
        bill.billType === "cash_bill" || bill.billType === "credit_bill"
          ? (
              await allocateDocumentNumber(tx, {
                seriesType: bill.billType,
                storeId: bill.storeId,
                financialYearId: bill.financialYearId,
              })
            ).documentNumber
          : bill.documentNumber;

      return tx.bill.update({
        where: { id },
        data: {
          status: "completed",
          completedAt: new Date(),
          receiptSnapshot,
          documentNumber: realDocumentNumber,
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
      afterData: result,
    });

    return Response.json(result);
  });
}
