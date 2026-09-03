import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { getRefundableAmount } from "@/lib/billing/getRefundableAmount";
import { getReturnValue } from "@/lib/billing/getReturnValue";
import { refundCreateSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to create refunds.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, refundCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

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
    if (billReturn.creditNotes.length > 0) {
      return apiErrorResponse("bad_request", "This return already has a credit note.", 400);
    }

    const method = await db.paymentMethod.findUnique({ where: { id: data.refundMethodId } });
    if (!method || !method.isActive) {
      return apiErrorResponse("bad_request", "Select a valid refund method.", 400);
    }

    const [{ amount: returnValue }, refundableCap, existingRefunds] = await Promise.all([
      getReturnValue(id),
      getRefundableAmount(billReturn.billId),
      db.refund.findMany({
        where: { sourceType: "bill_return", sourceId: id, status: { not: "failed" } },
      }),
    ]);
    const alreadyRefunded = existingRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
    if (alreadyRefunded >= returnValue - 0.01) {
      return apiErrorResponse("bad_request", "This return has already been fully refunded.", 400);
    }
    // refundableCap is the whole bill's remaining pool (paid − already refunded across every
    // return/cancellation on it) — this return can't draw more than what's left of its own
    // value, nor more than that shared pool actually has in it.
    const maxAllowed = Math.min(returnValue - alreadyRefunded, refundableCap);
    if (data.amount > maxAllowed + 0.01) {
      return apiErrorResponse(
        "bad_request",
        `This refund can't exceed ${maxAllowed} — the remaining amount actually collected on this bill.`,
        400,
      );
    }

    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "refund",
        storeId: billReturn.storeId,
        financialYearId: billReturn.financialYearId,
      });

      return tx.refund.create({
        data: {
          sourceType: "bill_return",
          sourceId: id,
          documentNumber,
          financialYearId: billReturn.financialYearId,
          storeId: billReturn.storeId,
          amount: data.amount,
          refundMethodId: data.refundMethodId,
          status: "completed",
          processedByUserId: session.user.id,
          completedAt: new Date(),
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "refund",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
