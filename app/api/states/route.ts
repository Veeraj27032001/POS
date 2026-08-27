import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const countryId = new URL(request.url).searchParams.get("countryId");
  const states = countryId
    ? await unscoped().state.findMany({
        where: { isActive: true, countryId },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      })
    : [];

  return Response.json({
    data: states,
    totalRecords: states.length,
    totalPages: 1,
    page: 1,
    pageSize: states.length,
  });
}
