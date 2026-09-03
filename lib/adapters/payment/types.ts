import type {
  PaymentRequestMethod as PrismaPaymentRequestMethod,
  PaymentRequestStatus as PrismaPaymentRequestStatus,
} from "@/generated/prisma/client";

export type PaymentRequestMethod = PrismaPaymentRequestMethod;
export type PaymentRequestStatus = PrismaPaymentRequestStatus;

export interface CreatePaymentRequestParams {
  documentNumber: string;
  amount: number;
  currency: string;
  method: PaymentRequestMethod;
  deliveryChannel?: "email" | "sms";
  customer?: { name?: string; email?: string; phone?: string };
}

export interface PaymentRequestResult {
  gatewayReference: string;
  presentationValue: string;
}

export interface PaymentStatusResult {
  status: PaymentRequestStatus;
  gatewayReference: string;
  paidAt?: Date;
  /** The gateway's own unique id for the captured transaction itself (e.g.
   * Razorpay's `pay_...`) — distinct from `gatewayReference`, which is the
   * QR code/payment link container id used for the whole request's
   * lifetime. Only present once a payment has actually been captured. */
  transactionId?: string;
  /** The full raw transaction record from the gateway, stored verbatim
   * against the resulting BillPayment for audit/support purposes. */
  transactionDetails?: Record<string, unknown>;
}

export interface RefundParams {
  gatewayReference: string;
  amount: number;
  currency: string;
}

export interface RefundResult {
  gatewayRefundReference: string;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface PaymentGateway {
  createRequest(params: CreatePaymentRequestParams): Promise<PaymentRequestResult>;
  checkStatus(gatewayReference: string): Promise<PaymentStatusResult>;
  refund(params: RefundParams): Promise<RefundResult>;
  /** The real external checkout URL to redirect a customer to when they
   * click "Pay Now" on our own public pay page — e.g. Razorpay's hosted
   * payment-link checkout. Returns null when there's nothing to redirect to
   * (the stub adapter completes in-page; a QR code is scanned, not clicked;
   * card_machine never reaches this page at all). */
  getCheckoutTarget(gatewayReference: string): Promise<string | null>;
}
