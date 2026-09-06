import { z } from "zod";

import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { serializeEcommerceCustomer } from "@/lib/ecommerce/serializeCustomer";
import { verifySecret } from "@/lib/security/hash";
import { phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ phone: phoneSchema, password: z.string().min(1) });

// The second sign-in option: phone + password, for an EcommerceCustomer who
// set one via customers/set-password.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const db = unscoped();
  const ecommerceCustomer = await db.ecommerceCustomer.findUnique({
    where: { phone: parsed.data.phone },
  });
  if (!ecommerceCustomer?.passwordHash) {
    return apiErrorResponse(
      "bad_request",
      "No password set for this phone number — sign in with a code instead.",
      400,
    );
  }

  const valid = await verifySecret(parsed.data.password, ecommerceCustomer.passwordHash);
  if (!valid) {
    return apiErrorResponse("bad_request", "Incorrect phone number or password.", 400);
  }

  const customer = await db.customer.findUnique({ where: { id: ecommerceCustomer.customerId } });
  return Response.json({ customer: serializeEcommerceCustomer(ecommerceCustomer, customer!) });
}
