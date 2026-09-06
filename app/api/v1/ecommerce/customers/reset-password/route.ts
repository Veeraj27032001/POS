import { z } from "zod";

import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { serializeEcommerceCustomer } from "@/lib/ecommerce/serializeCustomer";
import { verifyOtp } from "@/lib/ecommerce/customerAuth";
import { hashSecret } from "@/lib/security/hash";
import { phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  phone: phoneSchema,
  code: z.string().trim().length(6),
  newPassword: z.string().min(6, "At least 6 characters."),
});

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Request a new code first.",
  expired: "That code has expired — request a new one.",
  too_many_attempts: "Too many incorrect attempts — request a new code.",
  incorrect: "That code is incorrect.",
};

// "Forgot password": call customers/request-otp first to get a code, then
// this in one step — verifies it and sets the new password together, so a
// locked-out customer never needs to already know their own EcommerceCustomer
// id (unlike set-password, which assumes they're already signed in). Returns
// the customer, so the client can treat this as signing them in too.
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

  const db = unscoped();
  const passwordHash = await hashSecret(parsed.data.newPassword);
  const ecommerceCustomer = await db.ecommerceCustomer.update({
    where: { id: result.ecommerceCustomerId },
    data: { passwordHash },
  });
  const customer = await db.customer.findUnique({ where: { id: ecommerceCustomer.customerId } });

  return Response.json({ customer: serializeEcommerceCustomer(ecommerceCustomer, customer!) });
}
