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
  /** The real gateway checkout URL, when presentationValue points at our own page instead. */
  externalCheckoutUrl?: string;
}

export interface PaymentStatusResult {
  status: PaymentRequestStatus;
  gatewayReference: string;
  paidAt?: Date;
  /** The gateway's own unique captured-transaction id (e.g. Razorpay's `pay_...`). */
  transactionId?: string;
  /** The full raw transaction record from the gateway. */
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
  /** The real gateway checkout URL for a "Pay Now" click, or null if none. */
  getCheckoutTarget(gatewayReference: string): Promise<string | null>;
}
