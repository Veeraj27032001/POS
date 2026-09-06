import { z } from "zod";

import { requestOtp } from "@/lib/storefront/otp";
import { emailSchema, phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  phone: phoneSchema,
  email: emailSchema,
  name: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    await requestOtp(parsed.data);
  } catch {
    return apiErrorResponse("internal_error", "Failed to send the verification code.", 500);
  }

  return Response.json({ sent: true });
}
