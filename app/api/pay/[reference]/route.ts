import { getPaymentGateway } from "@/lib/adapters/payment";
import { reconcilePaymentRequestStatus } from "@/lib/billing/paymentRequests/reconcile";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Public, unauthenticated — this is the page a customer lands on from a
// scanned QR or a sent payment link. Only returns what's safe to show a
// stranger holding this one link.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const lookup = { OR: [{ gatewayReference: reference }, { id: reference }] };

  const existing = await unscoped().paymentRequest.findFirst({
    where: lookup,
    select: { id: true },
  });
  if (!existing) {
    return apiErrorResponse("not_found", "This payment link is invalid.", 404);
  }
  await reconcilePaymentRequestStatus(existing.id);

  const paymentRequest = await unscoped().paymentRequest.findFirst({
    where: lookup,
    include: {
      store: { select: { name: true } },
      bill: {
        select: {
          documentNumber: true,
          grandTotal: true,
          taxTotal: true,
          discountTotal: true,
          lines: {
            where: { status: "active" },
            select: { productName: true, quantity: true, unitPrice: true, lineTotal: true },
          },
        },
      },
    },
  });
  if (!paymentRequest) {
    return apiErrorResponse("not_found", "This payment link is invalid.", 404);
  }

  const checkoutUrl =
    paymentRequest.status === "pending" &&
    paymentRequest.method === "payment_link" &&
    paymentRequest.gatewayReference
      ? await getPaymentGateway().getCheckoutTarget(paymentRequest.gatewayReference)
      : null;

  return Response.json({
    documentNumber: paymentRequest.documentNumber,
    storeName: paymentRequest.store.name,
    amount: Number(paymentRequest.amount),
    method: paymentRequest.method,
    status: paymentRequest.status,
    checkoutUrl,
    bill: {
      documentNumber: paymentRequest.bill.documentNumber,
      grandTotal: Number(paymentRequest.bill.grandTotal),
      taxTotal: Number(paymentRequest.bill.taxTotal),
      discountTotal: Number(paymentRequest.bill.discountTotal),
      lines: paymentRequest.bill.lines.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
      })),
    },
  });
}
