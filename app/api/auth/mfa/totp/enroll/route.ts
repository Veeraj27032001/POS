import { auth } from "@/auth";
import { buildOtpAuthUri, buildOtpQrCodeDataUrl, generateTotpSecret } from "@/lib/auth/totp";
import { apiErrorResponse } from "@/lib/validation/response";
import { asAppSession } from "@/lib/auth/types";

export async function POST() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const secret = generateTotpSecret();
  const [otpAuthUri, qrCodeDataUrl] = await Promise.all([
    Promise.resolve(buildOtpAuthUri(session.user.email ?? session.user.id, secret)),
    buildOtpQrCodeDataUrl(session.user.email ?? session.user.id, secret),
  ]);

  return Response.json({ secret, otpAuthUri, qrCodeDataUrl });
}
