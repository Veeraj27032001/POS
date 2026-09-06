import { clearCustomerSessionCookie } from "@/lib/storefront/session";

export async function POST() {
  await clearCustomerSessionCookie();
  return Response.json({ ok: true });
}
