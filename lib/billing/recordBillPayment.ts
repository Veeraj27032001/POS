import type { Prisma } from "@/generated/prisma/client";
import { getBillOutstandingBalance } from "@/lib/credit/getOutstandingBalance";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";

export class RecordBillPaymentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RecordBillPaymentParams {
  billId: string;
  paymentMethodId: string;
  amount: number;
  referenceNumber?: string | null;
  financialYearId: string;
}

async function validateAndCreate(
  db: Prisma.TransactionClient | ReturnType<typeof unscoped>,
  params: RecordBillPaymentParams,
) {
  const bill = await db.bill.findUnique({ where: { id: params.billId } });
  if (!bill) throw new RecordBillPaymentError("not_found", "Bill not found.");

  const canPay =
    bill.status === "draft" ||
    bill.status === "held" ||
    (bill.status === "completed" && bill.billType === "credit_bill");
  if (!canPay) {
    throw new RecordBillPaymentError(
      "bad_request",
      `Can't record a payment on a ${bill.status} bill.`,
    );
  }

  const method = await db.paymentMethod.findUnique({ where: { id: params.paymentMethodId } });
  if (!method || !method.isActive) {
    throw new RecordBillPaymentError("bad_request", "Select a valid payment method.");
  }
  if (method.requiresReference && !params.referenceNumber) {
    throw new RecordBillPaymentError("bad_request", `${method.name} requires a reference number.`);
  }

  const remaining = await getBillOutstandingBalance(params.billId);
  if (params.amount > remaining + 0.01) {
    throw new RecordBillPaymentError(
      "bad_request",
      `This payment would exceed the bill total — ${remaining} remaining.`,
    );
  }

  const { documentNumber } = await allocateDocumentNumber(db as Prisma.TransactionClient, {
    seriesType: "bill_payment",
    storeId: bill.storeId,
    financialYearId: params.financialYearId,
  });

  return db.billPayment.create({
    data: {
      billId: params.billId,
      paymentMethodId: params.paymentMethodId,
      documentNumber,
      financialYearId: params.financialYearId,
      storeId: bill.storeId,
      amount: params.amount,
      referenceNumber: params.referenceNumber ?? null,
      status: "success",
    },
  });
}

// The single place a BillPayment row gets created, whether the cashier
// entered it directly (cash, a card swipe already confirmed at the
// counter) or a Payment Request (QR/link/card machine) reached `paid` —
// both paths funnel through here so every downstream reader (outstanding
// balance, bill totals, receipts) sees one consistent ledger.
//
// Pass `tx` when this needs to participate in a caller's own transaction
// (e.g. the payment-request reconcile flow, which gates this behind its
// own atomic compare-and-swap) — otherwise a transaction is opened here.
export async function recordBillPayment(
  params: RecordBillPaymentParams,
  tx?: Prisma.TransactionClient,
) {
  if (tx) return validateAndCreate(tx, params);
  return unscoped().$transaction((innerTx) => validateAndCreate(innerTx, params));
}
