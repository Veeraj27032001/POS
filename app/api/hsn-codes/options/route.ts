import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Lightly gated, like stores/options — every user needs to pick an HSN
// code when creating a product, even though managing the HSN Code master
// itself stays Super-Admin-only.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const hsnCodes = await unscoped().hsnCode.findMany({
    where: { isActive: true, isDeleted: false },
    orderBy: { hsnCode: "asc" },
    select: { id: true, hsnCode: true },
  });

  return Response.json({
    data: hsnCodes,
    totalRecords: hsnCodes.length,
    totalPages: 1,
    page: 1,
    pageSize: hsnCodes.length,
  });
}
