import { appPlatformSchema } from "@/lib/desktopReleases/schemas";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET(request: Request) {
  // Without a platform filter the header's desktop button would start handing
  // out whichever build was uploaded most recently — including an APK.
  const requested = new URL(request.url).searchParams.get("platform");
  const parsed = appPlatformSchema.safeParse(requested ?? "windows");
  if (!parsed.success) {
    return apiErrorResponse("bad_request", "Unknown platform.", 400);
  }

  const latest = await unscoped().desktopAppRelease.findFirst({
    where: { isActive: true, platform: parsed.data },
    orderBy: { createdAt: "desc" },
    select: { version: true, fileUrl: true, releaseNotes: true, platform: true },
  });
  if (!latest) return apiErrorResponse("not_found", "No release available.", 404);
  return Response.json(latest);
}
