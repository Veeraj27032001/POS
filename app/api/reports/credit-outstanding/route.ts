import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1-30 days";
  if (daysOverdue <= 60) return "31-60 days";
  if (daysOverdue <= 90) return "61-90 days";
  return "90+ days";
}

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "reports", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view reports.", 403);
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || undefined;
  const customerId = url.searchParams.get("customerId") || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const db = unscoped();
    const effectiveStoreId = session.user.storeId ?? storeId;
    if (!effectiveStoreId) {
      return apiErrorResponse("bad_request", "Select a store first.", 400);
    }

    const bills = await db.bill.findMany({
      where: {
        storeId: effectiveStoreId,
        billType: "credit_bill",
        status: "completed",
        ...(customerId ? { customerId } : {}),
        ...(search
          ? {
              OR: [
                { documentNumber: { contains: search, mode: "insensitive" as const } },
                { customer: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        documentNumber: true,
        billDate: true,
        dueDate: true,
        grandTotal: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    const billIds = bills.map((b) => b.id);
    const [creditNoteSums, paymentSums] = billIds.length
      ? await Promise.all([
          db.creditNote.groupBy({
            by: ["originalBillId"],
            where: { originalBillId: { in: billIds } },
            _sum: { amount: true },
          }),
          db.billPayment.groupBy({
            by: ["billId"],
            where: { billId: { in: billIds }, status: "success" },
            _sum: { amount: true },
          }),
        ])
      : [[], []];

    const creditNotesByBill = new Map(
      creditNoteSums.map((row) => [row.originalBillId, Number(row._sum.amount ?? 0)]),
    );
    const paymentsByBill = new Map(
      paymentSums.map((row) => [row.billId, Number(row._sum.amount ?? 0)]),
    );

    const now = new Date();
    const summary: Record<string, number> = {
      Current: 0,
      "1-30 days": 0,
      "31-60 days": 0,
      "61-90 days": 0,
      "90+ days": 0,
    };

    const allRows = bills
      .map((bill) => {
        const outstanding =
          Number(bill.grandTotal) -
          (creditNotesByBill.get(bill.id) ?? 0) -
          (paymentsByBill.get(bill.id) ?? 0);
        const daysOverdue = bill.dueDate
          ? Math.floor((now.getTime() - bill.dueDate.getTime()) / MS_PER_DAY)
          : -1;
        const bucket = agingBucket(daysOverdue);
        return {
          billId: bill.id,
          documentNumber: bill.documentNumber,
          billDate: bill.billDate.toISOString(),
          dueDate: bill.dueDate?.toISOString() ?? null,
          customerName: bill.customer?.name ?? "—",
          customerPhone: bill.customer?.phone ?? "—",
          grandTotal: Number(bill.grandTotal),
          outstanding: Math.round(outstanding * 100) / 100,
          daysOverdue: Math.max(0, daysOverdue),
          bucket,
        };
      })
      .filter((row) => row.outstanding > 0.01)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    for (const row of allRows) {
      summary[row.bucket] += row.outstanding;
    }
    for (const key of Object.keys(summary)) {
      summary[key] = Math.round(summary[key] * 100) / 100;
    }

    const totalRecords = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const data = countOnly
      ? []
      : allRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return Response.json({ totalRecords, totalPages, page: clampedPage, pageSize, data, summary });
  });
}
