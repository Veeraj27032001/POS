import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// GET /v1/ecommerce/orders/{order_id} — single order lookup, for an order
// confirmation page right after checkout or a tracking link. Works across
// the whole lifecycle: pending (awaiting staff acceptance), accepted (a real
// Bill now exists — its authoritative totals are merged in), or rejected.
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const { orderId } = await params;
  const db = unscoped();
  const order = await db.ecommerceOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      store: { select: { name: true } },
      bill: { select: { documentNumber: true, subtotal: true, taxTotal: true, grandTotal: true } },
    },
  });
  if (!order || !auth.storeIds.includes(order.storeId)) {
    return apiErrorResponse("not_found", "Order not found.", 404);
  }

  return Response.json({
    id: order.id,
    documentNumber: order.documentNumber,
    status: order.status,
    rejectionReason: order.rejectionReason,
    storeName: order.store.name,
    subtotal: order.bill ? Number(order.bill.subtotal) : null,
    taxTotal: order.bill ? Number(order.bill.taxTotal) : null,
    grandTotal: order.bill
      ? Number(order.bill.grandTotal)
      : order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
    billDocumentNumber: order.bill?.documentNumber ?? null,
    customerAddress: order.customerAddress,
    customerCity: order.customerCity,
    customerTaluk: order.customerTaluk,
    customerStateName: order.customerStateName,
    customerCountryName: order.customerCountryName,
    customerPincode: order.customerPincode,
    createdAt: order.createdAt,
    respondedAt: order.respondedAt,
    lines: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.unitPrice) * item.quantity,
    })),
  });
}
