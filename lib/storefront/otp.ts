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

export async function requestOtp(params: {
  phone: string;
  email: string;
  name?: string;
}): Promise<{ customerId: string }> {
  const db = unscoped();

  let customer = await db.customer.findFirst({ where: { phone: params.phone } });
  if (!customer) {
    customer = await db.customer.create({
      data: { phone: params.phone, email: params.email, name: params.name ?? null },
    });
  } else if (customer.email !== params.email || (params.name && customer.name !== params.name)) {
    customer = await db.customer.update({
      where: { id: customer.id },
      data: { email: params.email, name: params.name ?? customer.name },
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
  console.log(`[storefront-otp] code for ${params.phone} (${params.email}): ${code}`);

  const body = `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`;
  const smsConfigured = Boolean(env().FAST2SMS_API_KEY);
  await getNotifier().send(
    smsConfigured
      ? { to: params.phone, channel: "sms", body }
      : { to: params.email, channel: "email", subject: "Your sign-in code", body },
  );

  return { customerId: customer.id };
}

export type VerifyOtpResult =
  | { ok: true; customerId: string }
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

  const customer = await db.customer.findFirst({ where: { phone } });
  if (!customer) return { ok: false, reason: "not_found" };

  return { ok: true, customerId: customer.id };
}
