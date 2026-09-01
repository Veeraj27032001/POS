import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { getReturnValue } from "@/lib/billing/getReturnValue";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to create credit notes.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const billReturn = await db.billReturn.findUnique({
      where: { id },
      include: { bill: true, creditNotes: { select: { id: true } } },
    });
    if (!billReturn) return apiErrorResponse("not_found", "Return not found.", 404);
    if (session.user.storeId && billReturn.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Return not found.", 404);
    }
    if (!billReturn.bill.customerId) {
      return apiErrorResponse(
        "bad_request",
        "This bill has no customer — issue a Refund instead.",
        400,
      );
    }
    if (billReturn.creditNotes.length > 0) {
      return apiErrorResponse("bad_request", "This return already has a credit note.", 400);
    }
    const existingRefund = await db.refund.findFirst({
      where: { sourceType: "bill_return", sourceId: id },
    });
    if (existingRefund) {
      return apiErrorResponse("bad_request", "This return has already been refunded.", 400);
    }

    const { amount, taxBreakdown } = await getReturnValue(id);

    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "credit_note",
        storeId: billReturn.storeId,
        financialYearId: billReturn.financialYearId,
      });

      return tx.creditNote.create({
        data: {
          documentNumber,
          financialYearId: billReturn.financialYearId,
          storeId: billReturn.storeId,
          sourceType: "bill_return",
          billReturnId: id,
          originalBillId: billReturn.billId,
          customerId: billReturn.bill.customerId!,
          amount,
          taxBreakdown: taxBreakdown as never,
          createdByUserId: session.user.id,
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "credit_note",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
