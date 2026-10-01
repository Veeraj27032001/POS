import { auth } from "@/auth";
import { hasPermission, SUPER_ADMIN_ROLE_NAME } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { parseListQueryParams } from "@/lib/pagination";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "audit_logs", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view activity logs.", 403);
  }

  const url = new URL(request.url);
  const params = parseListQueryParams(url.searchParams);
  const viewerIsSuperAdmin = session.user.roleName === SUPER_ADMIN_ROLE_NAME;

  // Only a Super Admin sees what other Super Admins did. Everyone else gets
  // the rest of the activity, including unattributed system entries.
  const where = viewerIsSuperAdmin
    ? {}
    : {
        OR: [{ userId: null }, { user: { role: { name: { not: SUPER_ADMIN_ROLE_NAME } } } }],
      };

  return withStoreContext(async () => {
    const totalRecords = await prisma.auditLog.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / params.pageSize));
    const page = Math.min(Math.max(1, params.page), totalPages);

    if (url.searchParams.get("countOnly") === "1") {
      return Response.json({
        totalRecords,
        totalPages,
        page,
        pageSize: params.pageSize,
        data: [],
      });
    }

    const entries = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        user: { select: { name: true, role: { select: { name: true } } } },
        store: { select: { name: true } },
      },
    });

    return Response.json({
      totalRecords,
      totalPages,
      page,
      pageSize: params.pageSize,
      data: entries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        userName: entry.user?.name ?? "System",
        roleName: entry.user?.role?.name ?? "—",
        storeName: entry.store?.name ?? "—",
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
      })),
    });
  });
}
