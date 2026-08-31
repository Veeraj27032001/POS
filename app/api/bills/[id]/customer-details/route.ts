import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billCustomerDetailsSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Billing detail fields, not a separate "create customer" step: whatever's
// in these fields just is the customer attached to this bill. First
// meaningful input creates the customer record and attaches it; further
// edits update that same record; clearing everything detaches it (walk-in).
// Selecting an existing customer from the dropdown (billAttachCustomerSchema
// via PATCH /api/bills/[id]) and then editing a field here updates that same
// shared record — same as picking someone and correcting their address.
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

    if (allEmpty) {
      if (bill.billType === "credit_bill") {
        return apiErrorResponse("bad_request", "A Credit Bill requires a customer.", 400);
      }
      if (!bill.customerId) {
        return Response.json(bill);
      }
      const updated = await db.bill.update({
        where: { id },
        data: { customerId: null },
        include: { customer: true },
      });
      return Response.json(updated);
    }

    const customerData = {
      name: data.name ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      countryId: data.countryId ?? null,
      stateId: data.stateId ?? null,
      pincode: data.pincode ?? null,
    };

    let customerId = bill.customerId;
    if (customerId) {
      await db.customer.update({ where: { id: customerId }, data: customerData });
    } else {
      const created = await db.customer.create({
        data: { ...customerData, stores: { connect: [{ id: bill.storeId }] } },
      });
      customerId = created.id;
    }

    const updated = await db.bill.update({
      where: { id },
      data: { customerId },
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
