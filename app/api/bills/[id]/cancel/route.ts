import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { releaseBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { billCancelSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { createNotification } from "@/lib/ecommerce/createNotification";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Cancels a held bill — permanent, not resumable, distinct from Discard
// (which only ever applies to an empty draft with nothing to release).
// Releases whatever stock the hold had blocked and records a
// BillCancellation for the trail.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billCancelSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't cancel a ${bill.status} bill.`, 400);
    }

    const reasonCode = await db.reasonCode.findUnique({ where: { id: data.reasonCodeId } });
    if (!reasonCode || reasonCode.category !== "void") {
      return apiErrorResponse("bad_request", "Select a valid cancellation reason.", 400);
    }

    const activeLines = await db.billLine.findMany({
      where: { billId: id, status: "active" },
      select: { id: true },
    });

    const result = await db.$transaction(async (tx) => {
      for (const line of activeLines) {
        await releaseBillLineAllocations(tx, line.id, session.user.id);
      }

      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "bill_cancellation",
        storeId: bill.storeId,
        financialYearId: bill.financialYearId,
      });
      const cancellation = await tx.billCancellation.create({
        data: {
          billId: id,
          billStatusAtCancellation: "held",
          documentNumber,
          financialYearId: bill.financialYearId,
          storeId: bill.storeId,
          reasonCodeId: data.reasonCodeId,
          cancelledByUserId: session.user.id,
        },
      });

      const updatedBill = await tx.bill.update({
        where: { id },
        data: { status: "cancelled" },
      });

      return { bill: updatedBill, cancellation };
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill",
      entityId: id,
      beforeData: bill,
      afterData: result.bill,
    });

    // step7 §6 — cancelling an online bill notifies the customer, since
    // they're not standing at the counter to be told in person.
    if (bill.billType === "online_bill" && bill.customerId) {
      void createNotification({
        customerId: bill.customerId,
        eventType: "order_cancelled",
        relatedType: "bill_cancellation",
        relatedId: result.cancellation.id,
      });
    }

    return Response.json(result);
  });
}
