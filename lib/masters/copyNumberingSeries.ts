import { unscoped } from "@/lib/db";
import { SERIES_PREFIXES, SERIES_TYPES } from "@/lib/numbering/seriesDefaults";

export async function createDefaultNumberingSeries(storeId: string) {
  const db = unscoped();
  const financialYears = await db.financialYear.findMany({
    where: { isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (financialYears.length === 0) return { createdCount: 0 };

  const result = await db.numberingSeries.createMany({
    data: financialYears.flatMap((fy) =>
      SERIES_TYPES.map((seriesType) => ({
        seriesType,
        storeId,
        financialYearId: fy.id,
        prefix: SERIES_PREFIXES[seriesType],
        currentNumber: 0,
      })),
    ),
    skipDuplicates: true,
  });

  return { createdCount: result.count };
}

export async function createNumberingSeriesForNewFinancialYear(financialYearId: string) {
  const db = unscoped();
  const stores = await db.store.findMany({
    where: { isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (stores.length === 0) return { createdCount: 0 };

  const result = await db.numberingSeries.createMany({
    data: stores.flatMap((store) =>
      SERIES_TYPES.map((seriesType) => ({
        seriesType,
        storeId: store.id,
        financialYearId,
        prefix: SERIES_PREFIXES[seriesType],
        currentNumber: 0,
      })),
    ),
    skipDuplicates: true,
  });

  return { createdCount: result.count };
}

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
