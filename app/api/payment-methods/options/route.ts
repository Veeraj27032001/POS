import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Lightly gated, like reason-codes/options and hsn-codes/options — every
// store user needs to pick a payment method when taking payment on a bill,
// even though managing the Payment Method master itself stays
// Super-Admin-only.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const paymentMethods = await unscoped().paymentMethod.findMany({
    where: { isActive: true, isDeleted: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json({
    data: paymentMethods,
    totalRecords: paymentMethods.length,
    totalPages: 1,
    page: 1,
    pageSize: paymentMethods.length,
  });
}
