import { z } from "zod";

import { issueCustomerSessionCookie } from "@/lib/storefront/session";
import { verifyOtp } from "@/lib/storefront/otp";
import { phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  phone: phoneSchema,
  code: z.string().trim().length(6),
});

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Request a new code first.",
  expired: "That code has expired — request a new one.",
  too_many_attempts: "Too many incorrect attempts — request a new code.",
  incorrect: "That code is incorrect.",
};

export async function POST(request: Request) {
  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const result = await verifyOtp(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return apiErrorResponse("bad_request", REASON_MESSAGES[result.reason], 400);
  }

  await issueCustomerSessionCookie(result.customerId);
  return Response.json({ ok: true });
}
