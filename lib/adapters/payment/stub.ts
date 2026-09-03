import { randomUUID } from "node:crypto";

import QRCode from "qrcode";

import type {
  CreatePaymentRequestParams,
  PaymentGateway,
  PaymentRequestResult,
  PaymentStatusResult,
  RefundParams,
  RefundResult,
} from "./types";

const statusByReference = new Map<string, PaymentStatusResult>();

export const stubPaymentGateway: PaymentGateway = {
  async createRequest(params: CreatePaymentRequestParams): Promise<PaymentRequestResult> {
    const gatewayReference = `stub_${randomUUID()}`;
    statusByReference.set(gatewayReference, { status: "pending", gatewayReference });

    // qr_code and payment_link both encode/point at the same public pay page.
    const payUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/pay/${gatewayReference}`;
    const presentationValue =
      params.method === "qr_code"
        ? await QRCode.toDataURL(payUrl)
        : params.method === "payment_link"
          ? payUrl
          : ""; // card_machine — nothing to render or send, it's a physical device interaction

    return { gatewayReference, presentationValue };
  },

  async checkStatus(gatewayReference: string): Promise<PaymentStatusResult> {
    return statusByReference.get(gatewayReference) ?? { status: "expired", gatewayReference };
  },

  async refund(_params: RefundParams): Promise<RefundResult> {
    return {
      gatewayRefundReference: `stub_refund_${randomUUID()}`,
      status: "completed",
    };
  },

  async getCheckoutTarget(): Promise<string | null> {
    return null;
  },
};

export const stubPaymentDevControls = {
  markPaid(gatewayReference: string) {
    statusByReference.set(gatewayReference, {
      status: "paid",
      gatewayReference,
      paidAt: new Date(),
    });
  },
  markExpired(gatewayReference: string) {
    statusByReference.set(gatewayReference, { status: "expired", gatewayReference });
  },
};
