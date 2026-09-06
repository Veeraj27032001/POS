import { z } from "zod";

import { POST as ecommerceBillsPost } from "@/app/api/v1/ecommerce/bills/route";
import { getDemoCredential } from "@/lib/storefront/demoCredential";
import { getDefaultWarehouseId } from "@/lib/storefront/defaultWarehouse";
import { ecommerceAuthHeaders } from "@/lib/storefront/ecommerceHeaders";
import { getStorefrontCustomer } from "@/lib/storefront/session";
import { opaqueIdSchema, positiveInt } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({
  lines: z
    .array(
      z.object({
        productId: opaqueIdSchema,
        quantity: positiveInt,
        stockLockId: opaqueIdSchema.optional(),
      }),
    )
    .min(1),
});

// The storefront's "place order" step — called after the fake payment step
// succeeds. Fills the customer from the signed-in storefront session and
// calls the real POST /v1/ecommerce/bills, which releases each line's stock
// lock and permanently deducts stock.
export async function POST(request: Request) {
  const customer = await getStorefrontCustomer();
  if (!customer) {
    return apiErrorResponse("unauthorized", "Sign in before checking out.", 401);
  }
  if (!customer.phone) {
    return apiErrorResponse("bad_request", "Your account has no phone number on file.", 400);
  }

  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const credential = await getDemoCredential();
  const warehouseId = await getDefaultWarehouseId(credential.storeId);
  if (!warehouseId) {
    return apiErrorResponse("bad_request", "This store has no active warehouse configured.", 400);
  }

  const headers = await ecommerceAuthHeaders();
  const upstream = new Request(request.url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: {
        name: customer.name ?? "Customer",
        phone: customer.phone,
        email: customer.email ?? undefined,
      },
      lines: parsed.data.lines.map((line) => ({ ...line, warehouseId })),
    }),
  });
  return ecommerceBillsPost(upstream);
}
