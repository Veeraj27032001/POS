import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { hsnCodeImportSchema } from "@/lib/masters/schemas";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "hsn_codes", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to import HSN codes.", 403);
  }

  const parsed = await parseJsonOrRespond(request, hsnCodeImportSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of parsed.data.rows) {
      const data = {
        hsnCode: row.hsnCode,
        description: row.description,
        cgstRate: row.cgstRate,
        sgstRate: row.sgstRate,
        igstRate: row.igstRate,
      };
      try {
        if (row.id) {
          await db.hsnCode.update({ where: { id: row.id }, data });
          updated += 1;
        } else {
          await db.hsnCode.create({ data });
          created += 1;
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          errors.push(`${row.hsnCode}: a record with this HSN code already exists.`);
        } else if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          errors.push(`${row.hsnCode}: record not found for update (was it deleted?).`);
        } else {
          throw error;
        }
      }
    }

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "hsn_code",
      entityId: "import",
      afterData: { created, updated, errorCount: errors.length },
    });

    return Response.json({ created, updated, errors });
  });
}
