import { z } from "zod";

import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { requestOtp } from "@/lib/ecommerce/customerAuth";
import { emailSchema, phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  phone: phoneSchema,
  email: emailSchema,
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
    await requestOtp({ ...parsed.data, storeId: auth.storeId });
  } catch {
    return apiErrorResponse("internal_error", "Failed to send the verification code.", 500);
  }

  return Response.json({ sent: true });
}
