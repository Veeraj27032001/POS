import { z } from "zod";

import { POST as ecommerceStockLockPost } from "@/app/api/v1/ecommerce/stock-lock/route";
import { getDemoCredential } from "@/lib/storefront/demoCredential";
import { getDefaultWarehouseId } from "@/lib/storefront/defaultWarehouse";
import { ecommerceAuthHeaders } from "@/lib/storefront/ecommerceHeaders";
import { opaqueIdSchema, positiveInt } from "@/lib/validation/common";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const schema = z.object({ productId: opaqueIdSchema, quantity: positiveInt });

// Called when an item is added to the storefront cart / checkout starts —
// reserves the stock via the real POST /v1/ecommerce/stock-lock. A shopper
// never picks a warehouse, so this fills in the store's default one.
export async function POST(request: Request) {
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
    body: JSON.stringify({ ...parsed.data, warehouseId }),
  });
  return ecommerceStockLockPost(upstream);
}
