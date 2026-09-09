import type { unscoped } from "@/lib/db";
import {
  EDITABLE_COMPLETED_BILL_WINDOW_HOURS,
  isCompletedBillStillEditable,
} from "@/lib/billing/editableCompletedBillWindow";
import { apiErrorResponse } from "@/lib/validation/response";

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
  const inProgress = line.bill.status === "draft" || line.bill.status === "held";
  const editableCompleted =
    line.bill.status === "completed" && isCompletedBillStillEditable(line.bill.completedAt);
  if (!inProgress && !editableCompleted) {
    const reason =
      line.bill.status === "completed"
        ? `This bill was completed more than ${EDITABLE_COMPLETED_BILL_WINDOW_HOURS} hours ago and can no longer be edited directly — use Return instead.`
        : `Can't edit a line on a ${line.bill.status} bill.`;
    return { error: apiErrorResponse("bad_request", reason, 400) } as const;
  }
  if (line.status !== "active") {
    return {
      error: apiErrorResponse("bad_request", "This line has already been removed.", 400),
    } as const;
  }
  return { line } as const;
}
