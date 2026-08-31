import type { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Shared guard for every bill-line mutation route (quantity, discount,
// void): the line must belong to the given bill, the caller's store, an
// in-progress (draft) bill, and still be active.
export async function loadEditableLine(
  db: ReturnType<typeof unscoped>,
  billId: string,
  lineId: string,
  storeId: string | null | undefined,
) {
  const line = await db.billLine.findUnique({
    where: { id: lineId },
    include: {
      bill: { include: { customer: true, store: { include: { taxEngine: true } } } },
    },
  });
  if (!line || line.billId !== billId) {
    return { error: apiErrorResponse("not_found", "Line not found.", 404) } as const;
  }
  if (storeId && line.bill.storeId !== storeId) {
    return { error: apiErrorResponse("not_found", "Line not found.", 404) } as const;
  }
  if (line.bill.status !== "draft") {
    return {
      error: apiErrorResponse(
        "bad_request",
        `Can't edit a line on a ${line.bill.status} bill.`,
        400,
      ),
    } as const;
  }
  if (line.status !== "active") {
    return {
      error: apiErrorResponse("bad_request", "This line has already been removed.", 400),
    } as const;
  }
  return { line } as const;
}
