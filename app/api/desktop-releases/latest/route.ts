import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const latest = await unscoped().desktopAppRelease.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { version: true, fileUrl: true, releaseNotes: true },
  });
  if (!latest) return apiErrorResponse("not_found", "No release available.", 404);
  return Response.json(latest);
}
