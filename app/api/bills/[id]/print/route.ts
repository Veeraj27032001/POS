import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { renderBillTemplate } from "@/lib/billing/renderBillTemplate";
import { resolveBillFormat } from "@/lib/billing/resolveBillFormat";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        store: true,
        customer: true,
        terminal: true,
        cashierUser: { select: { name: true } },
        lines: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }

    const format = await resolveBillFormat(bill.storeId, bill.billType, bill.billDate);
    if (!format) {
      return Response.json({ html: null });
    }

    const html = renderBillTemplate(format.templateHtml, {
      documentNumber: bill.documentNumber,
      billType: bill.billType,
      billDate: formatDateOnly(toDateOnly(bill.billDate)),
      status: bill.status,
      storeName: bill.store.name,
      storeAddress: bill.store.address,
      storeGstin: bill.store.gstin,
      headerText: bill.store.receiptHeaderText,
      footerText: bill.store.receiptFooterText,
      returnPolicyText: bill.store.returnPolicyText,
      customerName: bill.customer?.name ?? bill.customerName,
      customerPhone: bill.customer?.phone ?? bill.customerPhone,
      cashierName: bill.cashierUser.name,
      terminalName: bill.terminal.name,
      lines: bill.lines.map((line) => ({
        productName: line.productName,
        productBarcode: line.productBarcode,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        discountApplied: Number(line.discountApplied ?? 0),
        lineTotal: Number(line.lineTotal),
      })),
      subtotal: Number(bill.subtotal),
      discountTotal: Number(bill.discountTotal),
      taxTotal: Number(bill.taxTotal),
      grandTotal: Number(bill.grandTotal),
    });

    return Response.json({ html });
  });
}
