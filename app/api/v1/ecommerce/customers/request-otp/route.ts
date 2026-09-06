import { z } from "zod";

import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { NoDeliveryMethodError, requestOtp } from "@/lib/ecommerce/customerAuth";
import { emailSchema, phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  phone: phoneSchema,
  // Only required when SMS delivery isn't configured for this store — the
  // code has to go somewhere. requestOtp() enforces that, not this schema,
  // since it depends on server config the schema can't see.
  email: emailSchema.optional(),
  name: z.string().trim().min(1).optional(),
});

// step7 §5 — customer sign-in for a merchant's storefront: sends a one-time
// code by SMS (or email when no SMS provider is configured). Creates the
// Customer on first use, so the storefront needs no user database of its own.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    await requestOtp({ ...parsed.data, storeId: auth.billingStoreId });
  } catch (error) {
    if (error instanceof NoDeliveryMethodError) {
      return apiErrorResponse("bad_request", error.message, 400);
    }
    return apiErrorResponse("internal_error", "Failed to send the verification code.", 500);
  }

  return Response.json({ sent: true });
}
