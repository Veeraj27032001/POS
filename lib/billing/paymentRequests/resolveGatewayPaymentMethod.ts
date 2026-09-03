import type { PaymentMethodType, PaymentRequestMethod, Prisma } from "@/generated/prisma/client";

const GATEWAY_METHOD_MASTER: Record<
  PaymentRequestMethod,
  { name: string; type: PaymentMethodType }
> = {
  qr_code: { name: "UPI / QR", type: "upi" },
  payment_link: { name: "Payment Link", type: "other" },
  card_machine: { name: "Card Machine", type: "card" },
};

// Every gateway-collected payment posts as a real BillPayment, which needs
// a real PaymentMethod.id — these three rows are seeded on fresh installs
// (prisma/seed.ts), this is just the safety net for a database seeded
// before that existed.
export async function resolveGatewayPaymentMethod(
  tx: Prisma.TransactionClient,
  method: PaymentRequestMethod,
): Promise<string> {
  const spec = GATEWAY_METHOD_MASTER[method];
  const existing = await tx.paymentMethod.findFirst({ where: { name: spec.name } });
  if (existing) return existing.id;

  const created = await tx.paymentMethod.create({
    data: { name: spec.name, type: spec.type, requiresReference: false },
  });
  return created.id;
}
