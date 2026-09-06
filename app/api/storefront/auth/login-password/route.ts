import { z } from "zod";

import { unscoped } from "@/lib/db";
import { verifySecret } from "@/lib/security/hash";
import { issueCustomerSessionCookie } from "@/lib/storefront/session";
import { phoneSchema } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ phone: phoneSchema, password: z.string().min(1) });

export async function POST(request: Request) {
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

  await issueCustomerSessionCookie(customer.id);
  return Response.json({ ok: true });
}
