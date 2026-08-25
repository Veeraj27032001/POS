import { z } from "zod";

import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { verifyTotpToken } from "@/lib/auth/totp";
import { prisma, unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

const deleteDeviceSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Must be a 6-digit code.")
    .optional(),
});

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const { id } = await context.params;
  const parsed = await parseJsonOrRespond(request, deleteDeviceSchema);
  if ("response" in parsed) return parsed.response;

  const db = unscoped();
  const device = await db.mfaDevice.findUnique({ where: { id } });
  if (!device || device.userId !== session.user.id) {
    return apiErrorResponse("not_found", "Device not found.", 404);
  }

  const remainingCount = await db.mfaDevice.count({
    where: { userId: session.user.id, id: { not: id } },
  });
  const isLastDevice = remainingCount === 0;

  if (isLastDevice) {
    if (!parsed.data.code || !(await verifyTotpToken(device.secret, parsed.data.code))) {
      return apiErrorResponse(
        "invalid_code",
        "Enter a valid code from this device to remove your last authenticator.",
        400,
      );
    }
  }

  await db.mfaDevice.delete({ where: { id } });

  await withStoreContext(async () => {
    if (isLastDevice) {
      await prisma.user.update({ where: { id: session.user.id }, data: { mfaMethod: null } });
    }
    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "mfa_device",
      entityId: id,
    });
  });

  return Response.json({ status: "removed", mfaDisabled: isLastDevice });
}
