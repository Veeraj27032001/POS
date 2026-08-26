import { auth } from "@/auth";
import { roleRank, SUPER_ADMIN_ROLE_NAME } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const roles = await unscoped().role.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Super Admin is never offered here, full stop — not even to a Super
  // Admin viewer (see SUPER_ADMIN_ROLE_NAME). Beyond that, never offer a
  // role ranked above the requester's own — an Admin shouldn't see roles
  // it couldn't assign anyway.
  const viewerRank = roleRank(session.user.roleName);
  const visible = roles.filter(
    (role) => role.name !== SUPER_ADMIN_ROLE_NAME && roleRank(role.name) >= viewerRank,
  );

  return Response.json({
    data: visible,
    totalRecords: visible.length,
    totalPages: 1,
    page: 1,
    pageSize: visible.length,
  });
}
