import { unscoped } from "@/lib/db";

export async function resolveFinancialYearForDate(date: Date) {
  return unscoped().financialYear.findFirst({
    where: { isActive: true, startDate: { lte: date }, endDate: { gte: date } },
  });
}
