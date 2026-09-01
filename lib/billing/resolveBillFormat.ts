import { unscoped } from "@/lib/db";
import type { BillFormat } from "@/generated/prisma/client";

export async function resolveBillFormat(
  storeId: string,
  billDate: Date,
): Promise<BillFormat | null> {
  const db = unscoped();

  const applicable = await db.billFormat.findFirst({
    where: { storeId, isActive: true, isDeleted: false, effectiveFrom: { lte: billDate } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (applicable) return applicable;

  return db.billFormat.findFirst({
    where: { storeId, isActive: true, isDeleted: false, isDefault: true },
  });
}
