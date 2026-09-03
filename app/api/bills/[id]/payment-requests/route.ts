import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  getPaymentGateway,
  isPaymentGatewayGloballyDisabled,
  isStubPaymentGatewayActive,
} from "@/lib/adapters/payment";
import { getNotifier } from "@/lib/adapters/notifier";
import { paymentRequestCreateSchema } from "@/lib/billing/schemas";
import { getBillOutstandingBalance } from "@/lib/credit/getOutstandingBalance";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
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
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }

    const requests = await db.paymentRequest.findMany({
      where: { billId: id },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ data: requests });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isPaymentGatewayGloballyDisabled()) {
    return apiErrorResponse("bad_request", "Payment gateway collection is disabled.", 400);
  }

  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }
  if (!session.user.financialYearId) {
    return apiErrorResponse("bad_request", "Select a financial year first.", 400);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, paymentRequestCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  if (data.deliveryChannel && data.method !== "payment_link") {
    return apiErrorResponse(
      "bad_request",
      "A delivery channel only applies to a payment link.",
      400,
    );
  }

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({
      where: { id },
      include: { customer: true, store: { include: { currency: true } } },
    });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.store.disablePaymentGateway) {
      return apiErrorResponse(
        "bad_request",
        "Payment gateway collection is disabled for this store.",
        400,
      );
    }

    const outstanding = await getBillOutstandingBalance(id);
    const reservedAgg = await db.paymentRequest.aggregate({
      _sum: { amount: true },
      where: { billId: id, status: "pending" },
    });
    const alreadyReserved = Number(reservedAgg._sum.amount ?? 0);
    const available = Math.max(0, outstanding - alreadyReserved);

    const amount = data.amount ?? available;
    if (amount <= 0 || amount > available + 0.01) {
      return apiErrorResponse(
        "bad_request",
        `This request can't exceed ${available} — the remaining amount owed on this bill.`,
        400,
      );
    }

    const created = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "payment_request",
        storeId: bill.storeId,
        financialYearId: session.user.financialYearId!,
      });
      return tx.paymentRequest.create({
        data: {
          billId: id,
          documentNumber,
          financialYearId: session.user.financialYearId!,
          storeId: bill.storeId,
          amount,
          method: data.method,
          deliveryChannel: data.deliveryChannel,
          status: "pending",
          createdByUserId: session.user.id,
        },
      });
    });

    const customerName = bill.customer?.name ?? bill.customerName ?? undefined;
    const customerEmail = bill.customer?.email ?? bill.customerEmail ?? undefined;
    const customerPhone = bill.customer?.phone ?? bill.customerPhone ?? undefined;

    const gatewayResult = await getPaymentGateway().createRequest({
      documentNumber: created.documentNumber,
      amount,
      currency: bill.store.currency?.code ?? "INR",
      method: data.method,
      deliveryChannel: data.deliveryChannel,
      customer: { name: customerName, email: customerEmail, phone: customerPhone },
    });

    await db.paymentRequest.update({
      where: { id: created.id },
      data: { gatewayReference: gatewayResult.gatewayReference },
    });

    let deliverySent: boolean | undefined;
    if (data.deliveryChannel) {
      const to = data.deliveryChannel === "email" ? customerEmail : customerPhone;
      if (to) {
        const result = await getNotifier()
          .send({
            to,
            channel: data.deliveryChannel,
            subject: "Payment link",
            body: `Please complete your payment: ${gatewayResult.presentationValue}`,
          })
          .catch(() => ({ status: "failed" as const }));
        deliverySent = result.status === "sent";
      } else {
        deliverySent = false;
      }
    }

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "payment_request",
      entityId: created.id,
      afterData: created,
    });

    return Response.json(
      {
        id: created.id,
        documentNumber: created.documentNumber,
        method: created.method,
        amount,
        deliveryChannel: created.deliveryChannel,
        status: "pending",
        gatewayReference: gatewayResult.gatewayReference,
        presentationValue: gatewayResult.presentationValue,
        deliverySent,
        devSimulateAvailable: isStubPaymentGatewayActive(),
      },
      { status: 201 },
    );
  });
}
