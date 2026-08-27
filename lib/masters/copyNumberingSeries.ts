import { unscoped } from "@/lib/db";

export async function copyNumberingSeriesToStores(sourceStoreId: string, targetStoreIds: string[]) {
  if (targetStoreIds.length === 0) return { copiedCount: 0 };

  const db = unscoped();
  const sourceSeries = await db.numberingSeries.findMany({
    where: { storeId: sourceStoreId, isDeleted: false },
  });
  if (sourceSeries.length === 0) return { copiedCount: 0 };

  const result = await db.numberingSeries.createMany({
    data: targetStoreIds.flatMap((storeId) =>
      sourceSeries.map((series) => ({
        seriesType: series.seriesType,
        storeId,
        financialYearId: series.financialYearId,
        prefix: series.prefix,
        currentNumber: 0,
        isActive: series.isActive,
      })),
    ),
    skipDuplicates: true,
  });

  return { copiedCount: result.count };
}

export async function findReferenceStoreId(excludeStoreId: string): Promise<string | null> {
  const db = unscoped();
  const reference = await db.store.findFirst({
    where: {
      id: { not: excludeStoreId },
      isDeleted: false,
      isActive: true,
      numberingSeries: { some: { isDeleted: false } },
    },
    select: { id: true },
  });
  return reference?.id ?? null;
}
