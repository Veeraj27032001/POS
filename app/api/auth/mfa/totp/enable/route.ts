import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { prisma, unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function POST() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const deviceCount = await unscoped().mfaDevice.count({ where: { userId: session.user.id } });
  if (deviceCount === 0) {
    return apiErrorResponse(
      "no_devices",
      "Add an authenticator device before switching to this method.",
      400,
    );
  }

  await withStoreContext(async () => {
    await prisma.user.update({ where: { id: session.user.id }, data: { mfaMethod: "totp" } });
    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "user_mfa",
      entityId: session.user.id,
    });
  });

  return Response.json({ status: "enabled" });
}
