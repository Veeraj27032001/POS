import { auth } from "@/auth";
import { verifyEmailOtpChallenge } from "@/lib/auth/emailOtp";
import { mfaCodeSchema } from "@/lib/auth/schemas";
import { verifyTotpAgainstDevices } from "@/lib/auth/totp";
import { asAppSession } from "@/lib/auth/types";
import { prisma, unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const parsed = await parseJsonOrRespond(request, mfaCodeSchema);
  if ("response" in parsed) return parsed.response;

  const user = await unscoped().user.findUnique({ where: { id: session.user.id } });
  if (!user?.mfaMethod) {
    return apiErrorResponse("mfa_not_enabled", "Two-factor authentication is not enabled.", 400);
  }

  const codeValid =
    user.mfaMethod === "totp"
      ? await verifyTotpAgainstDevices(user.id, parsed.data.code)
      : await verifyEmailOtpChallenge(user.id, parsed.data.code);
  if (!codeValid) {
    return apiErrorResponse("invalid_code", "That code is incorrect or has expired.", 400);
  }

  await withStoreContext(async () => {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaMethod: null },
    });
    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "user_mfa",
      entityId: session.user.id,
    });
  });

  return Response.json({ status: "disabled" });
}
