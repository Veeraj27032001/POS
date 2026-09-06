import { z } from "zod";

import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { verifyOtp } from "@/lib/ecommerce/customerAuth";
import { phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ phone: phoneSchema, code: z.string().trim().length(6) });

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Request a new code first.",
  expired: "That code has expired — request a new one.",
  too_many_attempts: "Too many incorrect attempts — request a new code.",
  incorrect: "That code is incorrect.",
};

// Verifies the code from request-otp and returns the customer. The
// storefront issues its own session from this — this API is stateless.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const result = await verifyOtp(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return apiErrorResponse("bad_request", REASON_MESSAGES[result.reason], 400);
  }

  const customer = await unscoped().customer.findUnique({ where: { id: result.customerId } });
  return Response.json({
    customer: {
      id: customer!.id,
      name: customer!.name,
      phone: customer!.phone,
      email: customer!.email,
      hasPassword: Boolean(customer!.passwordHash),
    },
  });
}
