import { unscoped } from "@/lib/db";
import { generatePublicToken, generateSecretToken, hashSecret } from "@/lib/security";

const DEMO_LABEL = "Storefront Demo";

interface DemoCredential {
  apiKey: string;
  apiSecret: string;
  storeId: string;
}

// The plaintext secret only ever exists at creation — same rule as a real
// merchant's credential. Cached for this server process's lifetime so the
// demo storefront (a same-app test harness, not a real merchant) doesn't
// need a human to create/paste one in first.
let cached: DemoCredential | null = null;

export async function getDemoCredential(): Promise<DemoCredential> {
  if (cached) return cached;

  const db = unscoped();
  const store = await db.store.findFirst({
    where: { isActive: true, isDeleted: false },
    orderBy: { createdAt: "asc" },
  });
  if (!store) {
    throw new Error("No active store exists yet — create one before using the demo storefront.");
  }

  const admin = await db.user.findFirst({
    where: { storeId: store.id, isActive: true, isDeleted: false },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new Error(
      `Store "${store.name}" has no active user to attribute the demo credential to.`,
    );
  }

  const apiKey = generatePublicToken("pk");
  const apiSecret = generateSecretToken();
  const apiSecretHash = await hashSecret(apiSecret);

  await db.apiCredential.create({
    data: {
      storeId: store.id,
      label: DEMO_LABEL,
      apiKey,
      apiSecretHash,
      createdByUserId: admin.id,
    },
  });

  cached = { apiKey, apiSecret, storeId: store.id };
  return cached;
}
