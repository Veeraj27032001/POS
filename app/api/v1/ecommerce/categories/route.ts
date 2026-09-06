import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// GET /v1/ecommerce/categories — for catalog navigation/filtering. Categories
// are a global master in this system, not store-specific.
export async function GET(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const categories = await unscoped().category.findMany({
    where: { isActive: true, isDeleted: false },
    select: { id: true, name: true, parentCategoryId: true },
    orderBy: { name: "asc" },
  });

  return Response.json({ data: categories });
}
