import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { mfaDeviceCreateSchema } from "@/lib/auth/schemas";
import { verifyTotpToken } from "@/lib/auth/totp";
import { prisma, unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const parsed = await parseJsonOrRespond(request, mfaDeviceCreateSchema);
  if ("response" in parsed) return parsed.response;

  const { secret, code, label } = parsed.data;
  const valid = await verifyTotpToken(secret, code);
  if (!valid) {
    return apiErrorResponse("invalid_code", "That code is incorrect or has expired.", 400);
  }

  const device = await unscoped().mfaDevice.create({
    data: { userId: session.user.id, label, secret },
  });

  await withStoreContext(async () => {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaMethod: "totp" },
    });
    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "mfa_device",
      entityId: device.id,
    });
  });

  return Response.json({ id: device.id, label: device.label, createdAt: device.createdAt });
}
