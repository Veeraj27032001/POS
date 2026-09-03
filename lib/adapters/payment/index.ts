import { env } from "@/lib/config/env";

import { razorpayPaymentGateway } from "./razorpay";
import { stubPaymentGateway } from "./stub";
import type { PaymentGateway } from "./types";

export type {
  PaymentGateway,
  PaymentRequestMethod,
  PaymentRequestStatus,
  CreatePaymentRequestParams,
  PaymentRequestResult,
  PaymentStatusResult,
  RefundParams,
  RefundResult,
} from "./types";
export { stubPaymentDevControls } from "./stub";

let cached: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;
  cached = env().PAYMENT_ADAPTER === "razorpay" ? razorpayPaymentGateway : stubPaymentGateway;
  return cached;
}

export function isStubPaymentGatewayActive(): boolean {
  return getPaymentGateway() === stubPaymentGateway;
}

// Deployment-wide kill switch, separate from a store's own disablePaymentGateway flag.
export function isPaymentGatewayGloballyDisabled(): boolean {
  return env().DISABLE_PAYMENT_GATEWAY;
}
