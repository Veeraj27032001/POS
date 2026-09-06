import { GET as ecommerceProductsGet } from "@/app/api/v1/ecommerce/products/route";
import { ecommerceAuthHeaders } from "@/lib/storefront/ecommerceHeaders";

// Storefront-only proxy — calls the real, documented GET /v1/ecommerce/products
// in-process with the demo credential, so the browser never sees an API secret.
export async function GET(request: Request) {
  const headers = await ecommerceAuthHeaders();
  const upstream = new Request(request.url, { headers });
  return ecommerceProductsGet(upstream);
}
