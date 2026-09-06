import { unscoped } from "@/lib/db";
import { getStorefrontCustomer } from "@/lib/storefront/session";
import { apiErrorResponse } from "@/lib/validation/response";

// "My orders" for the demo storefront — reads this customer's own online
// bills directly. Not part of the documented merchant API (step7's API set
// has no order-listing endpoint); this is storefront-internal only.
export async function GET() {
  const customer = await getStorefrontCustomer();
  if (!customer) {
    return apiErrorResponse("unauthorized", "Sign in to see your orders.", 401);
  }

  const bills = await unscoped().bill.findMany({
    where: { customerId: customer.id, billType: "online_bill" },
    orderBy: { createdAt: "desc" },
    include: { lines: { where: { status: "active" } } },
  });

  return Response.json({
    orders: bills.map((bill) => ({
      id: bill.id,
      documentNumber: bill.documentNumber,
      status: bill.status,
      grandTotal: Number(bill.grandTotal),
      createdAt: bill.createdAt,
      lines: bill.lines.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        lineTotal: Number(line.lineTotal),
      })),
    })),
  });
}
