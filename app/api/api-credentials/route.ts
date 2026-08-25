import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { apiCredentialResource } from "@/lib/masters/resources";
import { apiCredentialCreateSchema } from "@/lib/masters/schemas";
import { generatePublicToken, generateSecretToken, hashSecret } from "@/lib/security";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export const { GET } = apiCredentialResource;

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "settings", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to create settings.", 403);
  }
  if (!session.user.storeId) {
    return apiErrorResponse(
      "no_store_selected",
      "API credentials are store-specific — select a store first.",
      400,
    );
  }

  const parsed = await parseJsonOrRespond(request, apiCredentialCreateSchema);
  if ("response" in parsed) return parsed.response;

  const apiKey = generatePublicToken("pk");
  const apiSecret = generateSecretToken();
  const apiSecretHash = await hashSecret(apiSecret);

  const created = await withStoreContext(() =>
    prisma.apiCredential.create({
      data: {
        storeId: session.user.storeId!,
        label: parsed.data.label,
        apiKey,
        apiSecretHash,
        createdByUserId: session.user.id,
      },
    }),
  );

  await writeAuditLog({
    userId: session.user.id,
    storeId: session.user.storeId,
    action: "create",
    entityType: "api_credential",
    entityId: created.id,
  });

  return Response.json({ ...created, apiSecret });
}
