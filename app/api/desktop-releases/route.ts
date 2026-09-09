import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { desktopReleaseCreateSchema } from "@/lib/desktopReleases/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";
import { Prisma } from "@/generated/prisma/client";

// GET is deliberately open to any authenticated user, not gated behind the
// desktop_releases module — the version table and header download button
// are for every logged-in user, only uploading a new version is Super
// Admin-only (checked below, in POST).
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  return withStoreContext(async () => {
    const db = unscoped();
    const data = await db.desktopAppRelease.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    });
    return Response.json({ data });
  });
}

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "desktop_releases", "create")) {
    return apiErrorResponse("forbidden", "You don't have permission to upload a new release.", 403);
  }

  const parsed = await parseJsonOrRespond(request, desktopReleaseCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    let created;
    try {
      created = await db.desktopAppRelease.create({
        data: {
          version: data.version,
          fileUrl: data.fileUrl,
          fileSizeBytes: data.fileSizeBytes,
          releaseNotes: data.releaseNotes,
          uploadedByUserId: session.user.id,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return apiErrorResponse("conflict", `Version "${data.version}" already exists.`, 409);
      }
      throw error;
    }

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "desktop_app_release",
      entityId: created.id,
      afterData: created,
    });

    return Response.json(created, { status: 201 });
  });
}
