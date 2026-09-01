import { unscoped } from "@/lib/db";
import type { BillFormat, BillFormatKind, BillType } from "@/generated/prisma/client";

export async function resolveBillFormat(
  storeId: string,
  billType: BillType,
  formatKind: BillFormatKind,
  billDate: Date,
): Promise<BillFormat | null> {
  const db = unscoped();

  const applicable = await db.billFormat.findFirst({
    where: {
      storeId,
      billType,
      formatKind,
      isActive: true,
      isDeleted: false,
      effectiveFrom: { lte: billDate },
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (applicable) return applicable;

  return db.billFormat.findFirst({
    where: { storeId, billType, formatKind, isActive: true, isDeleted: false, isDefault: true },
  });
}
