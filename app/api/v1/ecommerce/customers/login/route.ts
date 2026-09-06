import { z } from "zod";

import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { verifySecret } from "@/lib/security/hash";
import { phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ phone: phoneSchema, password: z.string().min(1) });

// The second sign-in option: phone + password, for customers who set one via
// customers/set-password. Returns the customer on success.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const customer = await unscoped().customer.findFirst({ where: { phone: parsed.data.phone } });
  if (!customer?.passwordHash) {
    return apiErrorResponse(
      "bad_request",
      "No password set for this phone number — sign in with a code instead.",
      400,
    );
  }

  const valid = await verifySecret(parsed.data.password, customer.passwordHash);
  if (!valid) {
    return apiErrorResponse("bad_request", "Incorrect phone number or password.", 400);
  }

  return Response.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      hasPassword: true,
    },
  });
}
