import { auth } from "@/auth";
import { SUPER_ADMIN_ROLE_NAME } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  // A Super Admin's dashboard mirrors their full reach, so they see all
  // activity here too. For everyone else this widget is a personal "what have
  // I been doing" list; the store-wide picture lives on the permission-gated
  // Activity Log page.
  const isSuperAdmin = session.user.roleName === SUPER_ADMIN_ROLE_NAME;

  const entries = await withStoreContext(() =>
    prisma.auditLog.findMany({
      where: isSuperAdmin ? {} : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  );

  return Response.json({
    entries: entries.map((entry) => ({
      id: entry.id,
      userName: entry.user?.name ?? "System",
      action: entry.action,
      entityType: entry.entityType,
      createdAt: entry.createdAt,
    })),
  });
}
