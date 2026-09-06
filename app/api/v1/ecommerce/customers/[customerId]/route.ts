import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { serializeEcommerceCustomer } from "@/lib/ecommerce/serializeCustomer";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// GET /v1/ecommerce/customers/{customer_id} — profile re-fetch for an
// already-authenticated EcommerceCustomer (e.g. after a page refresh). This
// API trusts the credential holder to have verified the customer already —
// verify-otp/login are the actual authentication step.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const { customerId } = await params;
  const db = unscoped();
  const ecommerceCustomer = await db.ecommerceCustomer.findUnique({ where: { id: customerId } });
  if (!ecommerceCustomer) return apiErrorResponse("not_found", "Customer not found.", 404);

  const customer = await db.customer.findFirst({
    where: { id: ecommerceCustomer.customerId, stores: { some: { id: { in: auth.storeIds } } } },
  });
  if (!customer) return apiErrorResponse("not_found", "Customer not found.", 404);

  return Response.json({ customer: serializeEcommerceCustomer(ecommerceCustomer, customer) });
}
