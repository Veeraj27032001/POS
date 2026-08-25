export type PaymentRequestMethod = "qr_code" | "payment_link";
export type PaymentRequestStatus = "pending" | "paid" | "expired" | "cancelled";

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
}
