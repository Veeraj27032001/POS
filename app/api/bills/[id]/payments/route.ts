import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { RecordBillPaymentError, recordBillPayment } from "@/lib/billing/recordBillPayment";
import { billPaymentCreateSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Records one payment applied to a bill — a bill can have more than one,
// split across methods (step5 §12). Cash and any already-collected payment
// (a card swipe confirmed at the counter) is recorded here directly;
// gateway-collected payments (QR/link) flow in the same way once their
// Payment Request (§6) reaches `paid`, via the same recordBillPayment().
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }
  if (!session.user.financialYearId) {
    return apiErrorResponse("bad_request", "Select a financial year first.", 400);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billPaymentCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }

    let result;
    try {
      result = await recordBillPayment({
        billId: id,
        paymentMethodId: data.paymentMethodId,
        amount: data.amount,
        referenceNumber: data.referenceNumber,
        financialYearId: session.user.financialYearId!,
      });
    } catch (error) {
      if (error instanceof RecordBillPaymentError) {
        return apiErrorResponse(error.code, error.message, error.code === "not_found" ? 404 : 400);
      }
      throw error;
    }

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "bill_payment",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
