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
  if (!hasPermission(session.user.permissions, "reports", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view reports.", 403);
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || undefined;
  const customerId = url.searchParams.get("customerId") || undefined;
  const billType = url.searchParams.get("billType") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const db = unscoped();
    const effectiveStoreId = session.user.storeId ?? storeId;
    if (!effectiveStoreId) {
      return apiErrorResponse("bad_request", "Select a store first.", 400);
    }

    const billDateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) billDateFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) billDateFilter.lte = new Date(`${dateTo}T23:59:59.999Z`);

    const where = {
      storeId: effectiveStoreId,
      status: "completed" as const,
      ...(customerId ? { customerId } : {}),
      ...(billType ? { billType: billType as "cash_bill" | "credit_bill" | "online_bill" } : {}),
      ...(dateFrom || dateTo ? { billDate: billDateFilter } : {}),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: "insensitive" as const } },
              { customerName: { contains: search, mode: "insensitive" as const } },
              { customer: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const totalRecords = countOnly ? await db.bill.count({ where }) : 0;

    if (countOnly) {
      const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
      return Response.json({ totalRecords, totalPages, page: 1, pageSize, data: [] });
    }

    const [total, bills] = await Promise.all([
      db.bill.count({ where }),
      db.bill.findMany({
        where,
        select: {
          id: true,
          documentNumber: true,
          billDate: true,
          billType: true,
          customerName: true,
          customer: { select: { name: true } },
          subtotal: true,
          discountTotal: true,
          overallDiscount: true,
          taxTotal: true,
          grandTotal: true,
        },
        orderBy: { billDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(page, totalPages);

    const data = bills.map((bill) => ({
      id: bill.id,
      documentNumber: bill.documentNumber,
      billDate: bill.billDate.toISOString(),
      billType: bill.billType,
      customerName: bill.customer?.name ?? bill.customerName ?? "Walk-in",
      subtotal: Number(bill.subtotal),
      discountTotal: Number(bill.discountTotal) + Number(bill.overallDiscount),
      taxTotal: Number(bill.taxTotal),
      grandTotal: Number(bill.grandTotal),
    }));

    return Response.json({ totalRecords: total, totalPages, page: clampedPage, pageSize, data });
  });
}
