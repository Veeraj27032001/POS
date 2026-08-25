import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const financialYears = await unscoped().financialYear.findMany({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true, startDate: true, endDate: true },
  });

  return Response.json({ financialYears });
}
