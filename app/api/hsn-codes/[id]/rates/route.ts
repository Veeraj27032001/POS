import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Lightly gated, like stores/options — any authenticated user needs to be
// able to read one HSN code's rates to show tax details on a product they
// can already view, even though the full hsn_codes CRUD stays Super-Admin-only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const { id } = await params;
  const hsnCode = await unscoped().hsnCode.findUnique({
    where: { id },
    select: { cgstRate: true, sgstRate: true, igstRate: true },
  });
  if (!hsnCode) {
    return apiErrorResponse("not_found", "Record not found.", 404);
  }

  return Response.json(hsnCode);
}
