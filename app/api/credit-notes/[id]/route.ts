import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const creditNote = await db.creditNote.findUnique({
      where: { id },
      include: {
        originalBill: { select: { id: true, documentNumber: true, billType: true } },
        customer: { select: { name: true, phone: true } },
        billReturn: { select: { id: true, documentNumber: true } },
        billCancellation: { select: { id: true, documentNumber: true } },
        createdByUser: { select: { name: true } },
      },
    });
    if (!creditNote) return apiErrorResponse("not_found", "Credit note not found.", 404);
    if (session.user.storeId && creditNote.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Credit note not found.", 404);
    }

    return Response.json(creditNote);
  });
}
