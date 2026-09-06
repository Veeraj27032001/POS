import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// GET /v1/ecommerce/orders/{order_id} — single order lookup, for an order
// confirmation page right after checkout or a tracking link.
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const { orderId } = await params;
  const bill = await unscoped().bill.findUnique({
    where: { id: orderId },
    include: { lines: { where: { status: "active" } }, store: { select: { name: true } } },
  });
  if (!bill || !auth.storeIds.includes(bill.storeId) || bill.billType !== "online_bill") {
    return apiErrorResponse("not_found", "Order not found.", 404);
  }

  return Response.json({
    id: bill.id,
    documentNumber: bill.documentNumber,
    status: bill.status,
    billDate: bill.billDate,
    storeName: bill.store.name,
    subtotal: Number(bill.subtotal),
    taxTotal: Number(bill.taxTotal),
    grandTotal: Number(bill.grandTotal),
    customerAddress: bill.customerAddress,
    customerPincode: bill.customerPincode,
    createdAt: bill.createdAt,
    lines: bill.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
  });
}
