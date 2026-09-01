import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
    };

    const totalRecords = await db.refund.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const refunds = await db.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { refundMethod: { select: { name: true } } },
    });

    const returnIds = refunds.filter((r) => r.sourceType === "bill_return").map((r) => r.sourceId);
    const cancellationIds = refunds
      .filter((r) => r.sourceType === "bill_cancellation")
      .map((r) => r.sourceId);

    const [returns, cancellations] = await Promise.all([
      returnIds.length > 0
        ? db.billReturn.findMany({
            where: { id: { in: returnIds } },
            select: { id: true, documentNumber: true, bill: { select: { documentNumber: true } } },
          })
        : [],
      cancellationIds.length > 0
        ? db.billCancellation.findMany({
            where: { id: { in: cancellationIds } },
            select: { id: true, documentNumber: true, bill: { select: { documentNumber: true } } },
          })
        : [],
    ]);
    const returnById = new Map(returns.map((r) => [r.id, r]));
    const cancellationById = new Map(cancellations.map((c) => [c.id, c]));

    const data = refunds.map((r) => {
      const source =
        r.sourceType === "bill_return"
          ? returnById.get(r.sourceId)
          : cancellationById.get(r.sourceId);
      return {
        ...r,
        sourceDocumentNumber: source?.documentNumber ?? null,
        billDocumentNumber: source?.bill.documentNumber ?? null,
      };
    });

    return Response.json({ totalRecords, totalPages, page, pageSize, data });
  });
}
