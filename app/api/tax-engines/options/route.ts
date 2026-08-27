import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const engines = await unscoped().taxEngine.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json({
    data: engines,
    totalRecords: engines.length,
    totalPages: 1,
    page: 1,
    pageSize: engines.length,
  });
}
