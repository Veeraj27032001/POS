import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const currencies = await unscoped().currency.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, symbol: true },
  });

  return Response.json({
    data: currencies,
    totalRecords: currencies.length,
    totalPages: 1,
    page: 1,
    pageSize: currencies.length,
  });
}
