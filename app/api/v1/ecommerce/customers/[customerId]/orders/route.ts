import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { apiErrorResponse } from "@/lib/validation/response";

// "My orders" for a storefront — this EcommerceCustomer's orders across
// every store this integration can sell from, at whatever stage they're at
// (pending/accepted/rejected). {customerId} here is the EcommerceCustomer
// id (from verify-otp/login), resolved to the linked in-store Customer.
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

  const orders = await db.ecommerceOrder.findMany({
    where: { customerId: ecommerceCustomer.customerId, storeId: { in: auth.storeIds } },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      store: { select: { name: true } },
      bill: { select: { documentNumber: true, grandTotal: true } },
    },
  });

  return Response.json({
    orders: orders.map((order) => ({
      id: order.id,
      documentNumber: order.documentNumber,
      status: order.status,
      storeName: order.store.name,
      grandTotal: order.bill
        ? Number(order.bill.grandTotal)
        : order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
      createdAt: order.createdAt,
      lines: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.unitPrice) * item.quantity,
      })),
    })),
  });
}
