import { randomInt } from "node:crypto";

import { getNotifier } from "@/lib/adapters/notifier";
import { env } from "@/lib/config/env";
import { unscoped } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/security/hash";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Thrown when neither SMS nor a supplied email leaves any way to actually
// deliver the code — a 400 the storefront should show the customer, not a
// 500 (the request-otp route maps this to bad_request).
export class NoDeliveryMethodError extends Error {}

// Registers (on first use) or re-sends a code for an EcommerceCustomer —
// step7's own login identity, kept separate from the in-store Customer
// master. First registration also creates the linked Customer record, since
// that's what actually appears on the resulting Bill. `email` is only
// required when SMS delivery isn't configured — a phone-only storefront
// shouldn't have to collect an email it'll never use.
export async function requestOtp(params: {
  phone: string;
  email?: string;
  name?: string;
  storeId: string;
}): Promise<{ ecommerceCustomerId: string }> {
  const db = unscoped();
  const smsConfigured = Boolean(env().FAST2SMS_API_KEY);
  if (!smsConfigured && !params.email) {
    throw new NoDeliveryMethodError(
      "SMS delivery isn't configured for this store — provide an email to receive the code.",
    );
  }

  let ecommerceCustomer = await db.ecommerceCustomer.findUnique({ where: { phone: params.phone } });
  if (!ecommerceCustomer) {
    const customer = await db.customer.create({
      data: {
        phone: params.phone,
        email: params.email ?? null,
        name: params.name ?? null,
        stores: { connect: [{ id: params.storeId }] },
      },
    });
    ecommerceCustomer = await db.ecommerceCustomer.create({
      data: { phone: params.phone, customerId: customer.id },
    });
  } else {
    const customer = await db.customer.findUnique({ where: { id: ecommerceCustomer.customerId } });
    const linked = customer
      ? await db.customer.findFirst({
          where: { id: customer.id, stores: { some: { id: params.storeId } } },
        })
      : null;
    await db.customer.update({
      where: { id: ecommerceCustomer.customerId },
      data: {
        email: params.email ?? customer?.email,
        name: params.name ?? customer?.name,
        ...(linked ? {} : { stores: { connect: [{ id: params.storeId }] } }),
      },
    });
  }

  const code = generateCode();
  const codeHash = await hashSecret(code);
  await db.customerOtpChallenge.create({
    data: {
      phone: params.phone,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  // Also logged server-side so a developer can read the code without a real
  // inbox/handset during local testing.
  console.log(`[ecommerce-otp] code for ${params.phone} (${params.email ?? "no email"}): ${code}`);

  const body = `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`;
  await getNotifier().send(
    smsConfigured
      ? { to: params.phone, channel: "sms", body }
      : { to: params.email!, channel: "email", subject: "Your sign-in code", body },
  );

  return { ecommerceCustomerId: ecommerceCustomer.id };
}

export type VerifyOtpResult =
  | { ok: true; ecommerceCustomerId: string }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "incorrect" };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const db = unscoped();

  const challenge = await db.customerOtpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, reason: "not_found" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const valid = await verifySecret(code, challenge.codeHash);
  if (!valid) {
    await db.customerOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "incorrect" };
  }

  await db.customerOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const ecommerceCustomer = await db.ecommerceCustomer.findUnique({ where: { phone } });
  if (!ecommerceCustomer) return { ok: false, reason: "not_found" };

  return { ok: true, ecommerceCustomerId: ecommerceCustomer.id };
}
