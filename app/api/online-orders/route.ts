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
    return apiErrorResponse("forbidden", "You don't have permission to view online orders.", 403);
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: "insensitive" as const } },
              { customerName: { contains: search, mode: "insensitive" as const } },
              { customerPhone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const totalRecords = await db.ecommerceOrder.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const data = await db.ecommerceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { select: { id: true } },
        bill: { select: { documentNumber: true, grandTotal: true } },
      },
    });
    return Response.json({
      totalRecords,
      totalPages,
      page,
      pageSize,
      data: data.map((order) => ({
        id: order.id,
        documentNumber: order.documentNumber,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        itemCount: order.items.length,
        grandTotal: order.bill?.grandTotal ?? null,
        billDocumentNumber: order.bill?.documentNumber ?? null,
        createdAt: order.createdAt,
      })),
    });
  });
}
