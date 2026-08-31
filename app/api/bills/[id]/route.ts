import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billAttachCustomerSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
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
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        customer: true,
        terminal: true,
        cashierUser: { select: { id: true, name: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { stockTracked: true } },
            allocations: { include: { warehouse: { select: { id: true, name: true } } } },
          },
        },
        payments: { include: { paymentMethod: { select: { name: true, type: true } } } },
      },
    });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }

    return Response.json(bill);
  });
}

// Attaches a customer via the "existing customer" dropdown — a real FK
// link, clearing any typed plain fields (see POST .../customer-details).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billAttachCustomerSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft" && bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't update a ${bill.status} bill.`, 400);
    }

    const updates: Record<string, unknown> = {};

    if (data.customerId !== undefined) {
      if (bill.billType === "credit_bill" && data.customerId === null) {
        return apiErrorResponse("bad_request", "A Credit Bill requires a customer.", 400);
      }
      if (data.customerId) {
        const customer = await db.customer.findUnique({ where: { id: data.customerId } });
        if (!customer) {
          return apiErrorResponse("bad_request", "Customer not found.", 400);
        }
      }
      updates.customerId = data.customerId;
      if (data.customerId) {
        updates.customerName = null;
        updates.customerPhone = null;
        updates.customerEmail = null;
        updates.customerAddress = null;
        updates.customerCountryId = null;
        updates.customerStateId = null;
        updates.customerPincode = null;
      }
    }

    if (data.billDate !== undefined) {
      updates.billDate = dateOnlyToUtcMidnight(toDateOnly(data.billDate));
    }

    if (data.terminalId !== undefined) {
      const terminal = await db.terminal.findUnique({ where: { id: data.terminalId } });
      if (!terminal || terminal.storeId !== bill.storeId) {
        return apiErrorResponse("bad_request", "Select a terminal belonging to your store.", 400);
      }
      updates.terminalId = data.terminalId;
    }

    const updated = await db.bill.update({
      where: { id },
      data: updates,
      include: { customer: true },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "bill",
      entityId: id,
      beforeData: bill,
      afterData: updated,
    });

    return Response.json(updated);
  });
}

// Discards a bill that's still a draft — held/completed can't use this.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({ where: { id } });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft") {
      return apiErrorResponse("bad_request", `Can't discard a ${bill.status} bill.`, 400);
    }

    await db.bill.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "bill",
      entityId: id,
      beforeData: bill,
    });

    return Response.json({ ok: true });
  });
}
