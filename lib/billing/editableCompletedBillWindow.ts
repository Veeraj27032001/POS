export const EDITABLE_COMPLETED_BILL_WINDOW_HOURS = 2;

export function isCompletedBillStillEditable(completedAt: string | Date | null): boolean {
  if (!completedAt) return false;
  const elapsedMs = Date.now() - new Date(completedAt).getTime();
  return elapsedMs < EDITABLE_COMPLETED_BILL_WINDOW_HOURS * 60 * 60 * 1000;
}
