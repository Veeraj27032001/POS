import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const countries = await unscoped().country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, callingCode: true },
  });

  return Response.json({
    data: countries,
    totalRecords: countries.length,
    totalPages: 1,
    page: 1,
    pageSize: countries.length,
  });
}
