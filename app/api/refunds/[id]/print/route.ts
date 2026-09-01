import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { renderRefundTemplate } from "@/lib/billing/renderBillTemplate";
import { resolveBillFormat } from "@/lib/billing/resolveBillFormat";
import { formatTimestamp } from "@/lib/datetime/format";
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
    const refund = await db.refund.findUnique({
      where: { id },
      include: { refundMethod: { select: { name: true } } },
    });
    if (!refund) return apiErrorResponse("not_found", "Refund not found.", 404);
    if (session.user.storeId && refund.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Refund not found.", 404);
    }

    const source =
      refund.sourceType === "bill_return"
        ? await db.billReturn.findUnique({
            where: { id: refund.sourceId },
            select: { documentNumber: true, bill: { include: { store: true } } },
          })
        : await db.billCancellation.findUnique({
            where: { id: refund.sourceId },
            select: { documentNumber: true, bill: { include: { store: true } } },
          });
    if (!source) return apiErrorResponse("not_found", "Refund source not found.", 404);

    const format = await resolveBillFormat(
      refund.storeId,
      source.bill.billType,
      "refund",
      refund.createdAt,
    );
    if (!format) {
      return Response.json({ html: null });
    }

    const html = renderRefundTemplate(format.templateHtml, {
      documentNumber: refund.documentNumber,
      createdAt: formatTimestamp(refund.createdAt),
      storeName: source.bill.store.name,
      storeAddress: source.bill.store.address,
      storeGstin: source.bill.store.gstin,
      storeLogoUrl: source.bill.store.logoUrl,
      originalBillDocumentNumber: source.bill.documentNumber,
      sourceType: refund.sourceType === "bill_return" ? "Return" : "Cancellation",
      sourceDocumentNumber: source.documentNumber,
      refundMethodName: refund.refundMethod?.name ?? "",
      status: refund.status,
      amount: Number(refund.amount),
    });

    return Response.json({ html });
  });
}
