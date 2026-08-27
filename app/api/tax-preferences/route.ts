import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

const updateSchema = z.object({
  hsnTaxDisplayEnabled: z.boolean().optional(),
  autoApplyTaxByDefault: z.boolean().optional(),
});

async function getOrCreatePreferences() {
  const db = unscoped();
  const existing = await db.taxPreferences.findFirst();
  if (existing) return existing;
  return db.taxPreferences.create({ data: {} });
}

// Read is open to any authenticated user — Products (viewed by every role)
// need to know whether to show HSN-derived tax details. Only Super Admin
// can change the preference (see PATCH below).
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const preferences = await getOrCreatePreferences();
  return Response.json(preferences);
}

export async function PATCH(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "tax_settings", "update")) {
    return apiErrorResponse(
      "forbidden",
      "You don't have permission to change tax preferences.",
      403,
    );
  }

  const parsed = await parseJsonOrRespond(request, updateSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const existing = await getOrCreatePreferences();
    const updated = await unscoped().taxPreferences.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "tax_preferences",
      entityId: updated.id,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
