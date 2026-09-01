import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { renderCreditNoteTemplate } from "@/lib/billing/renderBillTemplate";
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
    const creditNote = await db.creditNote.findUnique({
      where: { id },
      include: {
        originalBill: { include: { store: true } },
        customer: true,
        billReturn: { include: { reasonCode: { select: { label: true } } } },
      },
    });
    if (!creditNote) return apiErrorResponse("not_found", "Credit note not found.", 404);
    if (session.user.storeId && creditNote.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Credit note not found.", 404);
    }

    const format = await resolveBillFormat(
      creditNote.storeId,
      creditNote.originalBill.billType,
      "credit_note",
      creditNote.createdAt,
    );
    if (!format) {
      return Response.json({ html: null });
    }

    const taxBreakdown = creditNote.taxBreakdown as {
      cgstAmount?: number;
      sgstAmount?: number;
      igstAmount?: number;
      taxAmount?: number;
    };

    const html = renderCreditNoteTemplate(format.templateHtml, {
      documentNumber: creditNote.documentNumber,
      createdAt: formatTimestamp(creditNote.createdAt),
      storeName: creditNote.originalBill.store.name,
      storeAddress: creditNote.originalBill.store.address,
      storeGstin: creditNote.originalBill.store.gstin,
      customerName: creditNote.customer.name ?? "",
      customerPhone: creditNote.customer.phone ?? "",
      originalBillDocumentNumber: creditNote.originalBill.documentNumber,
      reasonLabel: creditNote.billReturn?.reasonCode.label ?? "",
      amount: Number(creditNote.amount),
      taxBreakdown: {
        cgstAmount: Number(taxBreakdown.cgstAmount ?? 0),
        sgstAmount: Number(taxBreakdown.sgstAmount ?? 0),
        igstAmount: Number(taxBreakdown.igstAmount ?? 0),
        taxAmount: Number(taxBreakdown.taxAmount ?? 0),
      },
    });

    return Response.json({ html });
  });
}
