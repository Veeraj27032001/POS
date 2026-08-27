import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const timezones = await unscoped().timezone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json({
    data: timezones,
    totalRecords: timezones.length,
    totalPages: 1,
    page: 1,
    pageSize: timezones.length,
  });
}
