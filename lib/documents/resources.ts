import type { Prisma } from "@/generated/prisma/client";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { getStockLevels } from "@/lib/stock/getStockLevels";

import type { DocumentItemDelegate, DocumentMainDelegate } from "./defineDocumentResource";
import { defineDocumentResource } from "./defineDocumentResource";
import * as schemas from "./schemas";

function mainDelegateOf(name: string) {
  return (client: unknown) => (client as Record<string, DocumentMainDelegate>)[name];
}
function itemDelegateOf(name: string) {
  return (client: unknown) => (client as Record<string, DocumentItemDelegate>)[name];
}

export const productRequestResource = defineDocumentResource({
  name: "product_request",
  module: "stock",
  seriesType: "product_request",
  createSchema: schemas.productRequestCreateSchema,
  getMainDelegate: mainDelegateOf("productRequestMain"),
  getItemDelegate: itemDelegateOf("productRequestItem"),
  buildMainData: (data) => ({
    supplierId: data.supplierId,
    requestDate: dateOnlyToUtcMidnight(toDateOnly(data.requestDate)),
    status: "draft",
  }),
  buildItemData: (item) => ({
    quantityRequested: item.quantityRequested,
    expectedUnitCost: item.expectedUnitCost ?? null,
  }),
});

interface CreatedStockInwardItem {
  productId: string;
  quantityAccepted: number;
  unitCost: unknown;
}

export const stockInwardResource = defineDocumentResource({
  name: "stock_inward",
  module: "stock",
  seriesType: "stock_inward",
  createSchema: schemas.stockInwardCreateSchema,
  getMainDelegate: mainDelegateOf("stockInwardMain"),
  getItemDelegate: itemDelegateOf("stockInwardItem"),
  buildMainData: (data) => ({
    warehouseId: data.warehouseId,
    supplierId: data.supplierId ?? null,
    purchaseOrderId: data.purchaseOrderId ?? null,
    inwardDate: dateOnlyToUtcMidnight(toDateOnly(data.inwardDate)),
    notes: data.notes ?? null,
  }),
  buildItemData: (item) => ({
    quantityAccepted: item.quantityAccepted,
    quantityRejected: item.quantityRejected ?? null,
    expiryDate: item.expiryDate ? dateOnlyToUtcMidnight(toDateOnly(item.expiryDate)) : null,
    unitCost: item.unitCost ?? null,
  }),
  validateItem: async (item, data, tx) => {
    if (!data.purchaseOrderId) return null;
    const db = tx as Prisma.TransactionClient;
    const poItem = await db.productRequestItem.findFirst({
      where: { productRequestMainId: data.purchaseOrderId, productId: item.productId },
    });
    if (!poItem) return null;
    const outstanding = poItem.quantityRequested - poItem.quantityReceived;
    if (item.quantityAccepted > outstanding) {
      return `Cannot accept ${item.quantityAccepted} of ${poItem.productName} — only ${outstanding} outstanding on the linked product request.`;
    }
    return null;
  },
  afterCreate: async (tx, main, items) => {
    const db = tx as Prisma.TransactionClient;
    const createdItems = items as unknown as CreatedStockInwardItem[];
    const purchaseOrderId = (main as { purchaseOrderId: string | null }).purchaseOrderId;

    for (const item of createdItems) {
      if (item.unitCost != null) {
        await db.product.update({
          where: { id: item.productId },
          data: { defaultCostPrice: item.unitCost as never },
        });
      }
    }

    if (!purchaseOrderId) return;

    for (const item of createdItems) {
      await db.productRequestItem.updateMany({
        where: { productRequestMainId: purchaseOrderId, productId: item.productId },
        data: { quantityReceived: { increment: item.quantityAccepted } },
      });
    }

    const purchaseOrder = await db.productRequestMain.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    });
    if (!purchaseOrder || purchaseOrder.status === "cancelled") return;

    const allReceived = purchaseOrder.items.every((i) => i.quantityReceived >= i.quantityRequested);
    const anyReceived = purchaseOrder.items.some((i) => i.quantityReceived > 0);
    const newStatus = allReceived
      ? "received"
      : anyReceived
        ? "partially_received"
        : purchaseOrder.status;
    if (newStatus !== purchaseOrder.status) {
      await db.productRequestMain.update({
        where: { id: purchaseOrderId },
        data: { status: newStatus },
      });
    }
  },
});

export const stockDamageResource = defineDocumentResource({
  name: "stock_damage",
  module: "stock",
  seriesType: "stock_damage",
  createSchema: schemas.stockDamageCreateSchema,
  getMainDelegate: mainDelegateOf("stockDamageMain"),
  getItemDelegate: itemDelegateOf("stockDamageItem"),
  buildMainData: (data) => ({
    warehouseId: data.warehouseId,
    notes: data.notes ?? null,
  }),
  buildItemData: (item) => ({
    quantity: item.quantity,
    reasonCodeId: item.reasonCodeId,
  }),
  validateItem: async (item, data) => {
    const { available } = await getStockLevels({
      productId: item.productId,
      warehouseId: data.warehouseId,
    });
    if (item.quantity > available) {
      return `Cannot damage ${item.quantity} — only ${available} available at this warehouse.`;
    }
    return null;
  },
});

export const stockBlockResource = defineDocumentResource({
  name: "stock_block",
  module: "stock",
  seriesType: "stock_block",
  mainUserField: "blockedByUserId",
  mainTimestampField: "blockedAt",
  createSchema: schemas.stockBlockCreateSchema,
  getMainDelegate: mainDelegateOf("stockBlockMain"),
  getItemDelegate: itemDelegateOf("stockBlockItem"),
  buildMainData: (data) => ({
    warehouseId: data.warehouseId,
    sourceType: "manual",
    blockedAt: dateOnlyToUtcMidnight(toDateOnly(data.blockedDate)),
    reviewByDate: data.reviewByDate ? dateOnlyToUtcMidnight(toDateOnly(data.reviewByDate)) : null,
  }),
  buildItemData: (item) => ({
    quantityBlocked: item.quantityBlocked,
    reasonCodeId: item.reasonCodeId,
  }),
});
