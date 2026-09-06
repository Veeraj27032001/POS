import { z } from "zod";

import { unscoped } from "@/lib/db";
import { hashSecret } from "@/lib/security/hash";
import { getStorefrontCustomerId } from "@/lib/storefront/session";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ password: z.string().min(6, "At least 6 characters.") });

// Lets an already-OTP-verified customer set/change a password, so future
// sign-ins can use phone + password instead of a fresh OTP every time.
export async function POST(request: Request) {
  const customerId = await getStorefrontCustomerId();
  if (!customerId) {
    return apiErrorResponse("unauthorized", "Sign in first.", 401);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const passwordHash = await hashSecret(parsed.data.password);
  await unscoped().customer.update({ where: { id: customerId }, data: { passwordHash } });

  return Response.json({ ok: true });
}
