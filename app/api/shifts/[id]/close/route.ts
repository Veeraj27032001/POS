import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { shiftCloseSchema } from "@/lib/billing/schemas";
import { getShiftClosingExpected } from "@/lib/shifts/getShiftClosingExpected";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to close a shift.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, shiftCloseSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const shift = await db.shift.findUnique({ where: { id } });
    if (!shift) return apiErrorResponse("not_found", "Shift not found.", 404);
    if (session.user.storeId && shift.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Shift not found.", 404);
    }
    if (shift.status !== "open") {
      return apiErrorResponse("bad_request", `Can't close a ${shift.status} shift.`, 400);
    }

    const { closingExpected } = await getShiftClosingExpected(id);
    const variance = round2(data.closingCounted - closingExpected);

    let breakdownWarning: string | undefined;
    if (data.closingCounts && data.closingCounts.length > 0) {
      const breakdownSum = data.closingCounts.reduce((sum, c) => {
        return sum + c.quantityCounted;
      }, 0);
      if (breakdownSum > 0) {
        const denominations = await db.cashDenomination.findMany({
          where: { id: { in: data.closingCounts.map((c) => c.denominationId) } },
          select: { id: true, value: true },
        });
        const valueById = new Map(denominations.map((d) => [d.id, Number(d.value)]));
        const breakdownTotal = round2(
          data.closingCounts.reduce(
            (sum, c) => sum + (valueById.get(c.denominationId) ?? 0) * c.quantityCounted,
            0,
          ),
        );
        if (Math.abs(breakdownTotal - data.closingCounted) > 0.01) {
          breakdownWarning = `The denomination breakdown totals ${breakdownTotal}, not the entered ${data.closingCounted}.`;
        }
      }
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closingExpected: round2(closingExpected),
          closingCounted: data.closingCounted,
          variance,
        },
      });

      if (data.closingCounts && data.closingCounts.length > 0) {
        await tx.shiftCashCount.createMany({
          data: data.closingCounts.map((c) => ({
            shiftId: id,
            denominationId: c.denominationId,
            countType: "closing",
            quantityCounted: c.quantityCounted,
          })),
        });
      }

      return updated;
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "shift",
      entityId: id,
      beforeData: shift,
      afterData: result,
    });

    return Response.json({ ...result, breakdownWarning });
  });
}
