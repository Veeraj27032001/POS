import { getStorefrontCustomer } from "@/lib/storefront/session";

export async function GET() {
  const customer = await getStorefrontCustomer();
  if (!customer) return Response.json({ customer: null });
  return Response.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
  });
}
