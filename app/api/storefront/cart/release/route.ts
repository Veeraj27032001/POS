import { z } from "zod";

import { DELETE as ecommerceStockLockDelete } from "@/app/api/v1/ecommerce/stock-lock/[id]/route";
import { ecommerceAuthHeaders } from "@/lib/storefront/ecommerceHeaders";
import { opaqueIdSchema } from "@/lib/validation/common";
import { parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ lockId: opaqueIdSchema });

// Abandoned cart / cancelled checkout — releases the lock made above via
// the real DELETE /v1/ecommerce/stock-lock/{id}. A POST here (not a DELETE)
// since it needs a JSON body to name which lock, kept simple for the
// storefront's own fetch calls.
export async function POST(request: Request) {
  const parsed = await parseJsonOrRespond(request, schema);
  if ("response" in parsed) return parsed.response;

  const headers = await ecommerceAuthHeaders();
  const upstream = new Request(request.url, { headers });
  return ecommerceStockLockDelete(upstream, {
    params: Promise.resolve({ id: parsed.data.lockId }),
  });
}
