import { env } from "@/lib/config/env";

import type {
  CreatePaymentRequestParams,
  PaymentGateway,
  PaymentRequestResult,
  PaymentStatusResult,
  RefundParams,
  RefundResult,
} from "./types";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env();
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error(
      "RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET must be set in the environment when PAYMENT_ADAPTER=razorpay.",
    );
  }
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

async function razorpayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { error?: { description?: string } } | null)?.error?.description ??
      `Razorpay request failed (${res.status}).`;
    throw new Error(message);
  }
  return body as T;
}

const toPaise = (amount: number) => Math.round(amount * 100);

interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  status: string;
  payments?: Array<{ payment_id: string; status: string; created_at?: number }>;
}

// QR code and payment_link both resolve to a Razorpay Payment Link —
// its own hosted checkout already offers UPI/QR as one of the payment
// methods, so there's no separate QR Codes API integration to maintain.
async function createPaymentLink(
  params: CreatePaymentRequestParams,
): Promise<PaymentRequestResult> {
  const hasCustomer = Boolean(
    params.customer?.name || params.customer?.email || params.customer?.phone,
  );
  const ownPageUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/pay/${params.requestId}`;
  const link = await razorpayFetch<RazorpayPaymentLink>("/payment_links", {
    method: "POST",
    body: JSON.stringify({
      amount: toPaise(params.amount),
      currency: params.currency,
      accept_partial: false,
      description: params.documentNumber,
      customer: hasCustomer
        ? {
            name: params.customer?.name || "Customer",
            email: params.customer?.email,
            contact: params.customer?.phone,
          }
        : undefined,
      // Our own Notifier adapter delivers the link, not Razorpay's.
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { documentNumber: params.documentNumber },
      callback_url: ownPageUrl,
      callback_method: "get",
    }),
  });
  return {
    gatewayReference: link.id,
    presentationValue: ownPageUrl,
    externalCheckoutUrl: link.short_url,
  };
}

async function fetchFullPayment(paymentId: string): Promise<Record<string, unknown> | null> {
  return razorpayFetch<Record<string, unknown>>(`/payments/${paymentId}`).catch(() => null);
}

async function resolveCapturedPaymentId(gatewayReference: string): Promise<string | null> {
  if (!gatewayReference.startsWith("plink_")) return null;
  const link = await razorpayFetch<RazorpayPaymentLink>(`/payment_links/${gatewayReference}`);
  return link.payments?.find((p) => p.status === "captured")?.payment_id ?? null;
}

export const razorpayPaymentGateway: PaymentGateway = {
  async createRequest(params: CreatePaymentRequestParams): Promise<PaymentRequestResult> {
    if (params.method === "qr_code" || params.method === "payment_link") {
      return createPaymentLink(params);
    }
    // card_machine never talks to Razorpay — confirmed via the /confirm route.
    return {
      gatewayReference: `card_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      presentationValue: "",
    };
  },

  async checkStatus(gatewayReference: string): Promise<PaymentStatusResult> {
    if (!gatewayReference.startsWith("plink_")) {
      // card_machine references never reach here.
      return { status: "pending", gatewayReference };
    }

    const link = await razorpayFetch<RazorpayPaymentLink>(`/payment_links/${gatewayReference}`);
    if (link.status === "paid") {
      const captured = link.payments?.find((p) => p.status === "captured");
      const full = captured ? await fetchFullPayment(captured.payment_id) : null;
      return {
        status: "paid",
        gatewayReference,
        paidAt: captured?.created_at ? new Date(captured.created_at * 1000) : new Date(),
        transactionId: captured?.payment_id,
        transactionDetails: full ?? undefined,
      };
    }
    if (link.status === "cancelled" || link.status === "expired") {
      return { status: "expired", gatewayReference };
    }
    return { status: "pending", gatewayReference };
  },

  async getCheckoutTarget(gatewayReference: string): Promise<string | null> {
    if (!gatewayReference.startsWith("plink_")) return null;
    const link = await razorpayFetch<RazorpayPaymentLink>(`/payment_links/${gatewayReference}`);
    return link.short_url;
  },

  async refund(params: RefundParams): Promise<RefundResult> {
    const paymentId = await resolveCapturedPaymentId(params.gatewayReference);
    if (!paymentId) {
      throw new Error("Can't refund — no captured Razorpay payment found for this request.");
    }
    const result = await razorpayFetch<{ id: string; status: string }>(
      `/payments/${paymentId}/refund`,
      { method: "POST", body: JSON.stringify({ amount: toPaise(params.amount) }) },
    );
    return {
      gatewayRefundReference: result.id,
      status: result.status === "processed" ? "completed" : "pending",
    };
  },
};
