import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { renderBillTemplate } from "@/lib/billing/renderBillTemplate";
import { resolveBillFormat } from "@/lib/billing/resolveBillFormat";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;
  const typeParam = new URL(request.url).searchParams.get("type");
  const formatKind = typeParam === "receipt" ? "receipt" : "bill";

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        store: { include: { state: true, taxEngine: true } },
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

    const format = await resolveBillFormat(bill.storeId, bill.billType, formatKind, bill.billDate);
    if (!format) {
      return Response.json({ html: null });
    }

    const products = await db.product.findMany({
      where: { id: { in: bill.lines.map((l) => l.productId) } },
      include: { hsnCode: { select: { hsnCode: true } } },
    });
    const hsnByProductId = new Map(products.map((p) => [p.id, p.hsnCode?.hsnCode ?? null]));

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (bill.store.taxEngine?.code === "india_standard") {
      for (const line of bill.lines) {
        const breakdown = line.taxBreakdown as {
          cgstAmount?: number;
          sgstAmount?: number;
          igstAmount?: number;
        } | null;
        cgstAmount += Number(breakdown?.cgstAmount ?? 0);
        sgstAmount += Number(breakdown?.sgstAmount ?? 0);
        igstAmount += Number(breakdown?.igstAmount ?? 0);
      }
    } else {
      cgstAmount = 0;
      sgstAmount = 0;
      igstAmount = 0;
    }

    const html = renderBillTemplate(format.templateHtml, {
      documentNumber: bill.documentNumber,
      billType: bill.billType,
      billDate: formatDateOnly(toDateOnly(bill.billDate)),
      status: bill.status,
      storeName: bill.store.name,
      storeAddress: bill.store.address,
      storeGstin: bill.store.gstin,
      storeStateName: bill.store.state?.name,
      storeStateCode: bill.store.state?.code,
      storeLogoUrl: bill.store.logoUrl,
      headerText: bill.store.receiptHeaderText,
      footerText: bill.store.receiptFooterText,
      returnPolicyText: bill.store.returnPolicyText,
      customerName: bill.customer?.name ?? bill.customerName,
      customerPhone: bill.customer?.phone ?? bill.customerPhone,
      customerAddress: bill.customer?.address ?? bill.customerAddress,
      customerGstin: bill.customer?.taxId,
      cashierName: bill.cashierUser.name,
      terminalName: bill.terminal.name,
      lines: bill.lines.map((line) => ({
        productName: line.productName,
        productBarcode: line.productBarcode,
        productHsnCode: hsnByProductId.get(line.productId) ?? null,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice),
        discountApplied: Number(line.discountApplied ?? 0),
        lineAmount: Number(line.unitPrice) * line.quantity - Number(line.discountApplied ?? 0),
        lineTotal: Number(line.lineTotal),
      })),
      subtotal: Number(bill.subtotal),
      discountTotal: Number(bill.discountTotal),
      netSubtotal: Number(bill.subtotal) - Number(bill.discountTotal),
      cgstAmount,
      sgstAmount,
      igstAmount,
      taxTotal: Number(bill.taxTotal),
      grandTotal: Number(bill.grandTotal),
    });

    return Response.json({ html });
  });
}
