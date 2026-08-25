import { auth } from "@/auth";
import { issueEmailOtpChallenge } from "@/lib/auth/emailOtp";
import { asAppSession } from "@/lib/auth/types";
import { apiErrorResponse } from "@/lib/validation/response";

export async function POST() {
  const session = asAppSession(await auth());
  if (!session?.user?.email) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  await issueEmailOtpChallenge(session.user.id, session.user.email);
  return Response.json({ status: "sent" });
}
