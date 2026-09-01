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

    const totalRecords = await db.billReturn.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const returns = await db.billReturn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        bill: { select: { documentNumber: true, billType: true } },
        reasonCode: { select: { label: true } },
        creditNotes: { select: { id: true } },
      },
    });

    const refunds = await db.refund.findMany({
      where: { sourceType: "bill_return", sourceId: { in: returns.map((r) => r.id) } },
      select: { sourceId: true },
    });
    const refundedReturnIds = new Set(refunds.map((r) => r.sourceId));

    const data = returns.map((r) => ({
      ...r,
      settled: r.creditNotes.length > 0 || refundedReturnIds.has(r.id),
    }));

    return Response.json({ totalRecords, totalPages, page, pageSize, data });
  });
}
