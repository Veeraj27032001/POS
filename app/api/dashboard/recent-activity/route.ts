import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const entries = await withStoreContext(() =>
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  );

  return Response.json({
    entries: entries.map((entry) => ({
      id: entry.id,
      userName: entry.user?.name ?? "System",
      action: entry.action,
      entityType: entry.entityType,
      createdAt: entry.createdAt,
    })),
  });
}
