import { getDemoCredential } from "@/lib/storefront/demoCredential";

// The demo storefront calls the real /api/v1/ecommerce/* handlers directly,
// in-process, with these headers — the same authentication path a real
// merchant's server would use, just without an actual network hop.
export async function ecommerceAuthHeaders(): Promise<HeadersInit> {
  const credential = await getDemoCredential();
  return { "X-Api-Key": credential.apiKey, "X-Api-Secret": credential.apiSecret };
}
