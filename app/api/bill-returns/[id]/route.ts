import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { getRefundableAmount } from "@/lib/billing/getRefundableAmount";
import { getReturnValue } from "@/lib/billing/getReturnValue";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const billReturn = await db.billReturn.findUnique({
      where: { id },
      include: {
        lines: { include: { billLine: true, warehouse: { select: { name: true } } } },
        bill: { include: { customer: { select: { name: true, phone: true } } } },
        reasonCode: { select: { label: true } },
        processedByUser: { select: { name: true } },
        creditNotes: true,
      },
    });
    if (!billReturn) return apiErrorResponse("not_found", "Return not found.", 404);
    if (session.user.storeId && billReturn.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Return not found.", 404);
    }

    const refunds = await db.refund.findMany({
      where: { sourceType: "bill_return", sourceId: id },
      include: { refundMethod: { select: { name: true } } },
    });

    const [value, refundableAmount] = await Promise.all([
      getReturnValue(id),
      getRefundableAmount(billReturn.billId),
    ]);

    return Response.json({
      ...billReturn,
      refunds,
      value,
      refundableAmount,
      settled: billReturn.creditNotes.length > 0 || refunds.length > 0,
    });
  });
}
