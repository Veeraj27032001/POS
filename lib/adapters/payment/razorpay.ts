import type { PaymentGateway } from "./types";

export const razorpayPaymentGateway: PaymentGateway = {
  async createRequest() {
    throw new Error(
      "PAYMENT_ADAPTER=razorpay but RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET aren't wired up yet. " +
        "Implement this adapter against Razorpay's Orders/Payment Links API, or switch " +
        "PAYMENT_ADAPTER back to 'stub'.",
    );
  },
  async checkStatus() {
    throw new Error("PAYMENT_ADAPTER=razorpay is not yet implemented.");
  },
  async refund() {
    throw new Error("PAYMENT_ADAPTER=razorpay is not yet implemented.");
  },
};
