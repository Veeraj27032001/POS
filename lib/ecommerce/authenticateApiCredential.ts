import { unscoped } from "@/lib/db";
import { verifySecret } from "@/lib/security/hash";

export interface EcommerceAuthContext {
  credentialId: string;
  storeId: string;
  createdByUserId: string;
}

export async function authenticateApiCredential(
  request: Request,
): Promise<EcommerceAuthContext | null> {
  const apiKey = request.headers.get("x-api-key");
  const apiSecret = request.headers.get("x-api-secret");
  if (!apiKey || !apiSecret) return null;

  const db = unscoped();
  const credential = await db.apiCredential.findUnique({ where: { apiKey } });
  if (!credential || !credential.isActive || credential.isDeleted || credential.revokedAt) {
    return null;
  }

  const valid = await verifySecret(apiSecret, credential.apiSecretHash);
  if (!valid) return null;

  void db.apiCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    credentialId: credential.id,
    storeId: credential.storeId,
    createdByUserId: credential.createdByUserId,
  };
}
