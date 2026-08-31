import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billCreateSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

async function requireSession(action: string) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return { error: apiErrorResponse("unauthorized", "You must be signed in.", 401) } as const;
  }
  if (!hasPermission(session.user.permissions, "billing", action)) {
    return {
      error: apiErrorResponse("forbidden", `You don't have permission to ${action} bills.`, 403),
    } as const;
  }
  return { session } as const;
}

export async function GET(request: Request) {
  const authResult = await requireSession("view");
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const status = url.searchParams.get("status") ?? undefined;

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
      ...(status ? { status: status as never } : {}),
    };

    const totalRecords = await db.bill.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const data = await db.bill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: { select: { name: true, phone: true } } },
    });
    return Response.json({ totalRecords, totalPages, page, pageSize, data });
  });
}

export async function POST(request: Request) {
  const authResult = await requireSession("create");
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  if (!session.user.financialYearId) {
    return apiErrorResponse("bad_request", "Select a financial year first.", 400);
  }
  if (!session.user.storeId) {
    return apiErrorResponse(
      "forbidden",
      "A Super Admin session has no single store — sign in as a store user to bill.",
      403,
    );
  }

  const parsed = await parseJsonOrRespond(request, billCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const terminal = await db.terminal.findUnique({ where: { id: data.terminalId } });
    if (!terminal || terminal.storeId !== session.user.storeId) {
      return apiErrorResponse("bad_request", "Select a terminal belonging to your store.", 400);
    }

    if (data.customerId) {
      const customer = await db.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) {
        return apiErrorResponse("bad_request", "Customer not found.", 400);
      }
    }

    const openShift = await db.shift.findFirst({
      where: { terminalId: data.terminalId, cashierUserId: session.user.id, status: "open" },
    });

    const result = await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: data.billType,
        storeId: session.user.storeId!,
        financialYearId: session.user.financialYearId!,
      });

      return tx.bill.create({
        data: {
          documentNumber,
          financialYearId: session.user.financialYearId!,
          billType: data.billType,
          storeId: session.user.storeId!,
          terminalId: data.terminalId,
          cashierUserId: session.user.id,
          customerId: data.customerId ?? null,
          shiftId: openShift?.id ?? null,
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "create",
      entityType: "bill",
      entityId: result.id,
      afterData: result,
    });

    return Response.json(result, { status: 201 });
  });
}
