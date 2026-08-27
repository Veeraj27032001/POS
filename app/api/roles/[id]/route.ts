import { z } from "zod";

import { auth } from "@/auth";
import {
  ALL_MODULES,
  hasPermission,
  RBAC_ACTIONS,
  SUPER_ADMIN_ONLY_MODULES,
  SUPER_ADMIN_ROLE_NAME,
} from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const rightsUpdateSchema = z.object({
  rights: z.array(
    z.object({
      module: z.enum(ALL_MODULES as [string, ...string[]]),
      action: z.enum(RBAC_ACTIONS),
      allowed: z.boolean(),
    }),
  ),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "roles", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view roles.", 403);
  }

  const { id } = await params;
  const role = await unscoped().role.findUnique({
    where: { id },
    include: { roleRights: { select: { module: true, action: true, allowed: true } } },
  });
  if (!role || role.name === SUPER_ADMIN_ROLE_NAME) {
    return apiErrorResponse("not_found", "Role not found.", 404);
  }

  return Response.json(role);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "roles", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to edit roles.", 403);
  }

  const { id } = await params;
  const existing = await unscoped().role.findUnique({ where: { id } });
  if (!existing || existing.name === SUPER_ADMIN_ROLE_NAME) {
    return apiErrorResponse("not_found", "Role not found.", 404);
  }

  const parsed = await parseJsonOrRespond(request, rightsUpdateSchema);
  if ("response" in parsed) return parsed.response;

  // This endpoint never touches the Super Admin role itself (blocked above),
  // so every role it edits is structurally barred from these modules —
  // silently drop any submitted row for one, regardless of who's submitting,
  // rather than rejecting the whole request.
  const rights = parsed.data.rights.filter(
    (r) => !(SUPER_ADMIN_ONLY_MODULES as readonly string[]).includes(r.module),
  );

  await unscoped().$transaction(
    rights.map((r) =>
      unscoped().roleRight.upsert({
        where: { roleId_module_action: { roleId: id, module: r.module, action: r.action } },
        update: { allowed: r.allowed },
        create: { roleId: id, module: r.module, action: r.action, allowed: r.allowed },
      }),
    ),
  );

  const updated = await unscoped().role.findUnique({
    where: { id },
    include: { roleRights: { select: { module: true, action: true, allowed: true } } },
  });

  await writeAuditLog({
    userId: session.user.id,
    storeId: session.user.storeId,
    action: "update",
    entityType: "role",
    entityId: id,
    beforeData: existing,
    afterData: updated,
  });

  return Response.json(updated);
}
