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

// Replaces a line's warehouse allocations from scratch. Records which
// warehouse the stock comes from — does NOT reserve anything (see
// blockLineAllocations below for that). Releases any block still tied to
// the old allocation first, defensively.
export async function replaceBillLineAllocations(
  tx: Prisma.TransactionClient,
  params: {
    billLineId: string;
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
        data: { status: "released", releasedByUserId: null, releasedAt: new Date() },
      });
    }
  }
  await tx.billLineWarehouseAllocation.deleteMany({ where: { billLineId: params.billLineId } });

  for (const allocation of params.allocations) {
    await tx.billLineWarehouseAllocation.create({
      data: {
        billLineId: params.billLineId,
        warehouseId: allocation.warehouseId,
        quantity: allocation.quantity,
      },
    });
  }
}

// The actual stock reservation, called only from Hold — one StockBlock per
// current allocation row. Assumes availability was already checked.
export async function blockLineAllocations(
  tx: Prisma.TransactionClient,
  params: {
    billLineId: string;
    product: ProductSnapshot;
    storeId: string;
    financialYearId: string;
    userId: string;
    reasonCodeId: string;
  },
) {
  const allocations = await tx.billLineWarehouseAllocation.findMany({
    where: { billLineId: params.billLineId },
  });

  for (const allocation of allocations) {
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
        sourceId: allocation.id,
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
        reasonCodeId: params.reasonCodeId,
        status: "active",
      },
    });
  }
}

// Releases every active stock block reserving a bill line's allocations —
// called on void/cancel/complete.
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
