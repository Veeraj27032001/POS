import { unscoped } from "@/lib/db";
import { verifySecret } from "@/lib/security/hash";

export interface EcommerceAuthContext {
  credentialId: string;
  /** The credential's own store — the default/preferred one for fulfilment. */
  storeId: string;
  createdByUserId: string;
  multiStoreEnabled: boolean;
  splitOrdersEnabled: boolean;
  /** Every store this integration may sell from, preferred store first. */
  storeIds: string[];
}

// API-key auth for the e-commerce API set (step7 §5) — a separate mechanism
// from the session-cookie auth every other route uses, since these calls
// come from the merchant's own external e-commerce app/backend, not a
// signed-in user.
export async function authenticateApiCredential(
  request: Request,
): Promise<EcommerceAuthContext | null> {
  const apiKey = request.headers.get("x-api-key");
  const apiSecret = request.headers.get("x-api-secret");
  if (!apiKey || !apiSecret) return null;

  const db = unscoped();
  const credential = await db.apiCredential.findUnique({
    where: { apiKey },
    include: { fulfilmentStores: { select: { id: true, isActive: true, isDeleted: true } } },
  });
  if (!credential || !credential.isActive || credential.isDeleted || credential.revokedAt) {
    return null;
  }

  const valid = await verifySecret(apiSecret, credential.apiSecretHash);
  if (!valid) return null;

  void db.apiCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  const extraStoreIds = credential.multiStoreEnabled
    ? credential.fulfilmentStores
        .filter((s) => s.isActive && !s.isDeleted && s.id !== credential.storeId)
        .map((s) => s.id)
    : [];

  return {
    credentialId: credential.id,
    storeId: credential.storeId,
    createdByUserId: credential.createdByUserId,
    multiStoreEnabled: credential.multiStoreEnabled,
    splitOrdersEnabled: credential.splitOrdersEnabled,
    storeIds: [credential.storeId, ...extraStoreIds],
  };
}
