import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billPaymentCreateSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Records one payment applied to a bill — a bill can have more than one,
// split across methods (step5 §12). Cash and any already-collected payment
// (a card swipe confirmed at the counter) is recorded here directly;
// gateway-collected payments (QR/link) flow in the same way once their
// Payment Request (§6) reaches `paid`.
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
    if (bill.status !== "draft" && bill.status !== "held") {
      return apiErrorResponse(
        "bad_request",
        `Can't record a payment on a ${bill.status} bill.`,
        400,
      );
    }

    const method = await db.paymentMethod.findUnique({ where: { id: data.paymentMethodId } });
    if (!method || !method.isActive) {
      return apiErrorResponse("bad_request", "Select a valid payment method.", 400);
    }
    if (method.requiresReference && !data.referenceNumber) {
      return apiErrorResponse("bad_request", `${method.name} requires a reference number.`, 400);
    }

    const existingPayments = await db.billPayment.aggregate({
      _sum: { amount: true },
      where: { billId: id, status: "success" },
    });
    const alreadyPaid = Number(existingPayments._sum.amount ?? 0);
    if (alreadyPaid + data.amount > Number(bill.grandTotal) + 0.01) {
      return apiErrorResponse(
        "bad_request",
        `This payment would exceed the bill total — ${Number(bill.grandTotal) - alreadyPaid} remaining.`,
        400,
      );
    }

    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "bill_payment",
        storeId: bill.storeId,
        financialYearId: session.user.financialYearId!,
      });

      return tx.billPayment.create({
        data: {
          billId: id,
          paymentMethodId: data.paymentMethodId,
          documentNumber,
          financialYearId: session.user.financialYearId!,
          storeId: bill.storeId,
          amount: data.amount,
          referenceNumber: data.referenceNumber ?? null,
          status: "success",
        },
      });
    });

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
