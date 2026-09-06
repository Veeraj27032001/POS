import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { apiErrorResponse } from "@/lib/validation/response";

// "My orders" for a storefront — this customer's online bills at this
// credential's store only.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const { customerId } = await params;
  const bills = await unscoped().bill.findMany({
    where: { customerId, storeId: auth.storeId, billType: "online_bill" },
    orderBy: { createdAt: "desc" },
    include: { lines: { where: { status: "active" } } },
  });

  return Response.json({
    orders: bills.map((bill) => ({
      id: bill.id,
      documentNumber: bill.documentNumber,
      status: bill.status,
      billDate: bill.billDate,
      grandTotal: Number(bill.grandTotal),
      createdAt: bill.createdAt,
      lines: bill.lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
      })),
    })),
  });
}
