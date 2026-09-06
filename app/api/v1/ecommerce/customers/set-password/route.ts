import { z } from "zod";

import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { hashSecret } from "@/lib/security/hash";
import { opaqueIdSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  customerId: opaqueIdSchema,
  password: z.string().min(6, "At least 6 characters."),
});

// Sets/changes an EcommerceCustomer's password. `customerId` here is the
// EcommerceCustomer id (from verify-otp/login), not the in-store Customer.
// Call this only after the storefront has verified who the customer is —
// this API trusts the credential holder, it can't check that itself.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const db = unscoped();
  const ecommerceCustomer = await db.ecommerceCustomer.findUnique({
    where: { id: parsed.data.customerId },
  });
  if (!ecommerceCustomer) return apiErrorResponse("not_found", "Customer not found.", 404);

  const passwordHash = await hashSecret(parsed.data.password);
  await db.ecommerceCustomer.update({
    where: { id: ecommerceCustomer.id },
    data: { passwordHash },
  });

  return Response.json({ ok: true });
}
