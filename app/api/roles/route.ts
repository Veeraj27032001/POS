import { z } from "zod";

import { auth } from "@/auth";
import {
  ALL_MODULES,
  hasPermission,
  RBAC_ACTIONS,
  roleRank,
  SUPER_ADMIN_ROLE_NAME,
} from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

const roleCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((name) => name.toLowerCase() !== SUPER_ADMIN_ROLE_NAME.toLowerCase(), {
      message: "That name is reserved.",
    }),
});

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  const roles = await unscoped().role.findMany({
    where: {
      isActive: true,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    },
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

  const totalRecords = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const data = countOnly ? [] : visible.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return Response.json({ data, totalRecords, totalPages, page: clampedPage, pageSize });
}

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "roles", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to create roles.", 403);
  }

  const parsed = await parseJsonOrRespond(request, roleCreateSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const existing = await unscoped().role.findUnique({ where: { name: parsed.data.name } });
    if (existing) {
      return apiErrorResponse("conflict", "A role with that name already exists.", 409);
    }

    // Denies everything by default — the caller grants access module by
    // module afterward via PATCH /api/roles/[id].
    const role = await unscoped().role.create({
      data: {
        name: parsed.data.name,
        roleRights: {
          create: ALL_MODULES.flatMap((module) =>
            RBAC_ACTIONS.map((action) => ({ module, action, allowed: false })),
          ),
        },
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "role",
      entityId: role.id,
      afterData: role,
    });

    return Response.json(role, { status: 201 });
  });
}
