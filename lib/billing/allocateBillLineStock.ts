import type { Prisma } from "@/generated/prisma/client";

import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";

export interface BillLineAllocationInput {
  warehouseId: string;
  quantity: number;
}

interface ProductSnapshot {
  id: string;
  name: string;
  systemBarcode: string;
  price: unknown;
  hsnCode: { hsnCode: string } | null;
}

// Every scan/quantity change replaces a line's warehouse allocations (and
// the stock blocks reserving them) from scratch rather than diffing old vs
// new — simpler, and available stock is always computed fresh anyway so
// there's no running total to keep in sync.
export async function replaceBillLineAllocations(
  tx: Prisma.TransactionClient,
  params: {
    billLineId: string;
    product: ProductSnapshot;
    storeId: string;
    financialYearId: string;
    userId: string;
    allocations: BillLineAllocationInput[];
  },
) {
  const existingAllocations = await tx.billLineWarehouseAllocation.findMany({
    where: { billLineId: params.billLineId },
  });
  for (const allocation of existingAllocations) {
    const blockMain = await tx.stockBlockMain.findFirst({
      where: { sourceType: "draft_bill_line", sourceId: allocation.id },
    });
    if (blockMain) {
      await tx.stockBlockItem.updateMany({
        where: { stockBlockMainId: blockMain.id, status: "active" },
        data: { status: "released", releasedByUserId: params.userId, releasedAt: new Date() },
      });
    }
  }
  await tx.billLineWarehouseAllocation.deleteMany({ where: { billLineId: params.billLineId } });

  if (params.allocations.length === 0) return;

  const reason = await tx.reasonCode.findFirst({
    where: { category: "stock_block", label: "Reserved — pending bill" },
  });
  if (!reason) {
    throw new Error("Missing the 'Reserved — pending bill' reason code.");
  }

  for (const allocation of params.allocations) {
    const created = await tx.billLineWarehouseAllocation.create({
      data: {
        billLineId: params.billLineId,
        warehouseId: allocation.warehouseId,
        quantity: allocation.quantity,
      },
    });

    const { documentNumber } = await allocateDocumentNumber(tx, {
      seriesType: "stock_block",
      storeId: params.storeId,
      financialYearId: params.financialYearId,
    });
    const blockMain = await tx.stockBlockMain.create({
      data: {
        documentNumber,
        financialYearId: params.financialYearId,
        storeId: params.storeId,
        warehouseId: allocation.warehouseId,
        sourceType: "draft_bill_line",
        sourceId: created.id,
        blockedByUserId: params.userId,
        blockedAt: new Date(),
      },
    });
    await tx.stockBlockItem.create({
      data: {
        stockBlockMainId: blockMain.id,
        productId: params.product.id,
        productName: params.product.name,
        productBarcode: params.product.systemBarcode,
        productPrice: params.product.price as never,
        productHsnCode: params.product.hsnCode?.hsnCode ?? null,
        quantityBlocked: allocation.quantity,
        reasonCodeId: reason.id,
        status: "active",
      },
    });
  }
}

// Releases every active stock block reserving a bill line's allocations —
// called when the line is voided or the bill is cancelled/completed (a
// completed bill's stock deduction takes over via the Bill Line Warehouse
// Allocation term in getStockLevels, so the temporary block is no longer
// needed).
export async function releaseBillLineAllocations(
  tx: Prisma.TransactionClient,
  billLineId: string,
  userId: string,
) {
  const allocations = await tx.billLineWarehouseAllocation.findMany({ where: { billLineId } });
  for (const allocation of allocations) {
    const blockMain = await tx.stockBlockMain.findFirst({
      where: { sourceType: "draft_bill_line", sourceId: allocation.id },
    });
    if (blockMain) {
      await tx.stockBlockItem.updateMany({
        where: { stockBlockMainId: blockMain.id, status: "active" },
        data: { status: "released", releasedByUserId: userId, releasedAt: new Date() },
      });
    }
  }
}
