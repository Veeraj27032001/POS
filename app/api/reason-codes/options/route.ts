import { auth } from "@/auth";
import type { ReasonCodeCategory } from "@/generated/prisma/client";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

const VALID_CATEGORIES = new Set<ReasonCodeCategory>([
  "return",
  "void",
  "discount",
  "stock_adjustment",
  "damage",
  "stock_block",
]);

// Lightly gated, like stores/options and hsn-codes/options — every store
// user needs to pick a reason code when damaging/blocking/adjusting stock,
// even though managing the Reason Code master itself stays Super-Admin-only.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const categoryParam = new URL(request.url).searchParams.get("category");
  const category =
    categoryParam && VALID_CATEGORIES.has(categoryParam as ReasonCodeCategory)
      ? (categoryParam as ReasonCodeCategory)
      : undefined;

  const reasonCodes = await unscoped().reasonCode.findMany({
    where: { isActive: true, isDeleted: false, ...(category ? { category } : {}) },
    orderBy: { label: "asc" },
    select: { id: true, label: true },
  });

  return Response.json({
    data: reasonCodes,
    totalRecords: reasonCodes.length,
    totalPages: 1,
    page: 1,
    pageSize: reasonCodes.length,
  });
}
