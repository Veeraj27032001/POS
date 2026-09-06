import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { billCreateSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { formatTempBillNumber } from "@/lib/numbering/formatTempBillNumber";
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
  const billType = url.searchParams.get("billType") ?? undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(billType ? { billType: billType as never } : {}),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: "insensitive" as const } },
              { customerName: { contains: search, mode: "insensitive" as const } },
              { customerPhone: { contains: search, mode: "insensitive" as const } },
              { customer: { is: { name: { contains: search, mode: "insensitive" as const } } } },
              { customer: { is: { phone: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
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

    // A draft never touches the real cash_bill/credit_bill series — that's
    // only allocated at Create bill (see complete/route.ts). Until then it
    // gets a temp number from a separate series so nothing about the real
    // numbering is consumed by a bill that might be discarded, stay held
    // forever, or get cancelled.
    const tempSeriesType =
      data.billType === "cash_bill"
        ? "draft_cash_bill"
        : data.billType === "credit_bill"
          ? "draft_credit_bill"
          : data.billType;

    const result = await db.$transaction(async (tx) => {
      const allocated = await allocateDocumentNumber(tx, {
        seriesType: tempSeriesType,
        storeId: session.user.storeId!,
        financialYearId: session.user.financialYearId!,
      });
      const financialYearLabel = allocated.documentNumber.split("/")[1];
      const finalDocumentNumber =
        data.billType === "cash_bill" || data.billType === "credit_bill"
          ? formatTempBillNumber(data.billType, allocated.number, "draft", financialYearLabel)
          : allocated.documentNumber;

      return tx.bill.create({
        data: {
          documentNumber: finalDocumentNumber,
          financialYearId: session.user.financialYearId!,
          billType: data.billType,
          billDate: dateOnlyToUtcMidnight(toDateOnly(data.billDate)),
          storeId: session.user.storeId!,
          terminalId: data.terminalId,
          cashierUserId: session.user.id,
          customerId: data.customerId ?? null,
          shiftId: openShift?.id ?? null,
          taxExcluded: data.excludeTax,
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
