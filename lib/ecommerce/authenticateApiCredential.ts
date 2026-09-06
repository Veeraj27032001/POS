import { unscoped } from "@/lib/db";
import { verifySecret } from "@/lib/security/hash";

export interface EcommerceAuthContext {
  credentialId: string;
  /** The store an order bills to by default — the caller may still name a
   * different eligible store explicitly. */
  billingStoreId: string;
  createdByUserId: string;
  splitOrdersEnabled: boolean;
  /** Every store this credential may sell from and bill to. */
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
    include: { stores: { select: { id: true, isActive: true, isDeleted: true } } },
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

  const storeIds = credential.stores.filter((s) => s.isActive && !s.isDeleted).map((s) => s.id);
  if (!storeIds.includes(credential.billingStoreId)) storeIds.unshift(credential.billingStoreId);

  return {
    credentialId: credential.id,
    billingStoreId: credential.billingStoreId,
    createdByUserId: credential.createdByUserId,
    splitOrdersEnabled: credential.splitOrdersEnabled,
    storeIds,
  };
}
