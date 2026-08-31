import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { releaseBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { getOutstandingBalance } from "@/lib/credit/getOutstandingBalance";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Finalizes a bill — payments must already cover the grand total (§12),
// a Credit Bill is checked against its customer's credit limit (§13), and
// the receipt is snapshotted (§11, step3 §7's fidelity rule). Stock isn't
// explicitly deducted here: getStockLevels() already subtracts active Bill
// Line Warehouse Allocations on a `completed` bill, so flipping status is
// the deduction — only the now-redundant draft-bill blocks need releasing.
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
    const bill = await db.bill.findUnique({
      where: { id },
      include: { lines: { where: { status: "active" } }, store: true, customer: true },
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

    const payments = await db.billPayment.aggregate({
      _sum: { amount: true },
      where: { billId: id, status: "success" },
    });
    const totalPaid = Number(payments._sum.amount ?? 0);
    if (totalPaid < Number(bill.grandTotal)) {
      return apiErrorResponse(
        "bad_request",
        `Payments total ${totalPaid} — ${(Number(bill.grandTotal) - totalPaid).toFixed(2)} still due.`,
        400,
      );
    }

    if (bill.billType === "credit_bill") {
      if (!bill.customer) {
        return apiErrorResponse("bad_request", "A Credit Bill requires a customer.", 400);
      }
      if (bill.customer.creditLimit !== null) {
        const outstanding = await getOutstandingBalance(bill.customer.id);
        if (outstanding + Number(bill.grandTotal) > Number(bill.customer.creditLimit)) {
          return apiErrorResponse(
            "bad_request",
            `This would put ${bill.customer.name} over their credit limit (limit ${Number(bill.customer.creditLimit)}, currently owing ${outstanding}).`,
            400,
          );
        }
      }
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
      return tx.bill.update({
        where: { id },
        data: { status: "completed", completedAt: new Date(), receiptSnapshot },
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
