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
