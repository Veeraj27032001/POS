import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { releaseBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { unscoped } from "@/lib/db";
import { swapTempBillNumberPrefix } from "@/lib/numbering/formatTempBillNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Explicit demotion off Held — releases every line's block and drops the
// bill back to draft. Distinct from Resume, which leaves a held bill held
// (and blocked) while you look at or edit it.
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
    if (bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't make a ${bill.status} bill a draft.`, 400);
    }

    const activeLines = await db.billLine.findMany({
      where: { billId: id, status: "active" },
      select: { id: true },
    });

    const updated = await db.$transaction(async (tx) => {
      for (const line of activeLines) {
        await releaseBillLineAllocations(tx, line.id, session.user.id);
      }
      return tx.bill.update({
        where: { id },
        data: {
          status: "draft",
          documentNumber: swapTempBillNumberPrefix(bill.documentNumber, "draft"),
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
