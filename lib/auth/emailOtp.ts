import { randomInt } from "node:crypto";

import { getNotifier } from "@/lib/adapters/notifier";
import { unscoped } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/security/hash";

const CODE_TTL_MINUTES = 10;

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function issueEmailOtpChallenge(userId: string, email: string): Promise<void> {
  const code = generateCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  await unscoped().emailOtpChallenge.create({
    data: { userId, codeHash, expiresAt },
  });

  await getNotifier().send({
    to: email,
    channel: "email",
    subject: "Your verification code",
    body: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
  });
}

export async function verifyEmailOtpChallenge(userId: string, code: string): Promise<boolean> {
  const db = unscoped();
  const challenge = await db.emailOtpChallenge.findFirst({
    where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;

  const valid = await verifySecret(code, challenge.codeHash);
  if (!valid) return false;

  await db.emailOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return true;
}
