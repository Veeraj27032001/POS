import { GET as ecommerceStockGet } from "@/app/api/v1/ecommerce/products/[productId]/stock/route";
import { ecommerceAuthHeaders } from "@/lib/storefront/ecommerceHeaders";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = await ecommerceAuthHeaders();
  const upstream = new Request(request.url, { headers });
  return ecommerceStockGet(upstream, { params: Promise.resolve({ productId: id }) });
}
