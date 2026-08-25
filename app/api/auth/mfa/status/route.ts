import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const db = unscoped();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mfaMethod: true },
  });

  const devices = await db.mfaDevice.findMany({
    where: { userId: session.user.id },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ mfaMethod: user?.mfaMethod ?? null, devices });
}
