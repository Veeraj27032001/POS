import type { Prisma, SeriesType } from "@/generated/prisma/client";

export interface AllocatedDocumentNumber {
  documentNumber: string;
  seriesId: string;
  number: number;
}

export async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  params: { seriesType: SeriesType; storeId: string; financialYearId: string },
): Promise<AllocatedDocumentNumber> {
  const series = await tx.numberingSeries.findUnique({
    where: {
      seriesType_storeId_financialYearId: {
        seriesType: params.seriesType,
        storeId: params.storeId,
        financialYearId: params.financialYearId,
      },
    },
    include: { financialYear: true },
  });

  if (!series || !series.isActive) {
    throw new Error(
      `No active numbering series for ${params.seriesType} at store ${params.storeId} in the selected financial year.`,
    );
  }

  const updated = await tx.numberingSeries.update({
    where: { id: series.id },
    data: { currentNumber: { increment: 1 } },
  });

  const documentNumber = `${series.prefix ?? params.seriesType}/${series.financialYear.label}/${String(updated.currentNumber).padStart(4, "0")}`;

  return { documentNumber, seriesId: series.id, number: updated.currentNumber };
}
