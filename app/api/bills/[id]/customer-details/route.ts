import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billCustomerDetailsSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Typed billing-detail fields — deliberately NOT the Customers master. These
// live as plain columns directly on the Bill row, with no foreign key: a
// cashier jotting down a walk-in's name and phone shouldn't create or edit a
// record in the shared Customers table. The only way to get a real,
// FK-linked customer on a bill is picking one from the "existing customer"
// dropdown (billAttachCustomerSchema via PATCH /api/bills/[id]). Typing
// here always clears any such link — plain entry and a linked record are
// mutually exclusive, so editing a field after selecting someone detaches
// them and starts a fresh, unlinked entry from what's currently displayed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billCustomerDetailsSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id }, include: { customer: true } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft" && bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't update a ${bill.status} bill.`, 400);
    }

    const allEmpty =
      !data.name &&
      !data.phone &&
      !data.email &&
      !data.address &&
      !data.countryId &&
      !data.stateId &&
      !data.pincode;

    if (allEmpty && bill.billType === "credit_bill") {
      return apiErrorResponse("bad_request", "A Credit Bill requires a customer.", 400);
    }

    const updated = await db.bill.update({
      where: { id },
      data: {
        customerId: null,
        customerName: data.name ?? null,
        customerPhone: data.phone ?? null,
        customerEmail: data.email ?? null,
        customerAddress: data.address ?? null,
        customerCountryId: data.countryId ?? null,
        customerStateId: data.stateId ?? null,
        customerPincode: data.pincode ?? null,
      },
      include: { customer: true },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill",
      entityId: id,
      afterData: updated,
    });

    return Response.json(updated);
  });
}
