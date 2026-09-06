import { unscoped } from "@/lib/db";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { apiErrorResponse } from "@/lib/validation/response";

// "My orders" for a storefront — this EcommerceCustomer's online bills
// across every store this integration can sell from. {customerId} here is
// the EcommerceCustomer id (from verify-otp/login), resolved to the linked
// in-store Customer to find their actual bills.
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

  const bills = await db.bill.findMany({
    where: {
      customerId: ecommerceCustomer.customerId,
      storeId: { in: auth.storeIds },
      billType: "online_bill",
    },
    orderBy: { createdAt: "desc" },
    include: { lines: { where: { status: "active" } }, store: { select: { name: true } } },
  });

  return Response.json({
    orders: bills.map((bill) => ({
      id: bill.id,
      documentNumber: bill.documentNumber,
      status: bill.status,
      billDate: bill.billDate,
      storeName: bill.store.name,
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
