import { issueEmailOtpChallenge } from "@/lib/auth/emailOtp";
import { issueLoginTicket } from "@/lib/auth/loginTicket";
import { passwordLoginSchema } from "@/lib/auth/schemas";
import { unscoped } from "@/lib/db";
import { verifySecret } from "@/lib/security/hash";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

export async function POST(request: Request) {
  const parsed = await parseJsonOrRespond(request, passwordLoginSchema);
  if ("response" in parsed) return parsed.response;

  const db = unscoped();
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  if (!user || !user.isActive) {
    return apiErrorResponse("invalid_credentials", "Invalid email or password.", 401);
  }

  const passwordValid = await verifySecret(parsed.data.password, user.passwordHash);
  if (!passwordValid) {
    return apiErrorResponse("invalid_credentials", "Invalid email or password.", 401);
  }

  if (user.mfaMethod) {
    if (user.mfaMethod === "email_otp") {
      await issueEmailOtpChallenge(user.id, user.email);
    }
    const ticket = await issueLoginTicket({ userId: user.id, purpose: "verify-mfa" }, 300);
    return Response.json({ mfaRequired: true, method: user.mfaMethod, ticket });
  }

  const ticket = await issueLoginTicket({ userId: user.id, purpose: "complete-login" }, 120);
  return Response.json({ mfaRequired: false, ticket });
}
