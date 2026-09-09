// A completed bill's lines can still be corrected directly for a short
// window after completion (a cashier catching their own mistake) — after
// that, the fix is a Return/Credit Note/Refund instead, same as any
// already-settled real-world sale. Shared by both the API route (the real
// enforcement) and the bill detail page (so the edit controls don't appear
// only to fail once clicked).
export const EDITABLE_COMPLETED_BILL_WINDOW_HOURS = 12;

export function isCompletedBillStillEditable(completedAt: string | Date | null): boolean {
  if (!completedAt) return false;
  const elapsedMs = Date.now() - new Date(completedAt).getTime();
  return elapsedMs < EDITABLE_COMPLETED_BILL_WINDOW_HOURS * 60 * 60 * 1000;
}
