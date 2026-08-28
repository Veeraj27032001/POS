import { z } from "zod";

import {
  isoDateOnlySchema,
  nonNegativeDecimal,
  nonNegativeInt,
  opaqueIdSchema,
  optionalString,
  positiveInt,
} from "@/lib/validation/common";

export const productRequestItemSchema = z.object({
  productId: opaqueIdSchema,
  quantityRequested: positiveInt,
  expectedUnitCost: nonNegativeDecimal.optional().nullable(),
});
export const productRequestCreateSchema = z.object({
  supplierId: opaqueIdSchema,
  requestDate: isoDateOnlySchema,
  items: z.array(productRequestItemSchema).min(1, "At least one item is required."),
});

export const productRequestStatusSchema = z.enum([
  "draft",
  "sent",
  "partially_received",
  "received",
  "cancelled",
]);
export const productRequestUpdateStatusSchema = z.object({
  status: z.enum(["sent", "cancelled", "draft"]),
});

export const productRequestEditSchema = productRequestCreateSchema;

export const stockInwardItemSchema = z.object({
  productId: opaqueIdSchema,
  quantityAccepted: positiveInt,
  quantityRejected: nonNegativeInt.optional().nullable(),
  expiryDate: isoDateOnlySchema.optional().nullable(),
  unitCost: nonNegativeDecimal.optional().nullable(),
});
export const stockInwardCreateSchema = z.object({
  warehouseId: opaqueIdSchema,
  supplierId: opaqueIdSchema.optional().nullable(),
  purchaseOrderId: opaqueIdSchema.optional().nullable(),
  inwardDate: isoDateOnlySchema,
  notes: optionalString(1000),
  items: z.array(stockInwardItemSchema).min(1, "At least one item is required."),
});
export const stockInwardEditSchema = z.object({
  warehouseId: opaqueIdSchema,
  supplierId: opaqueIdSchema.optional().nullable(),
  inwardDate: isoDateOnlySchema,
  notes: optionalString(1000),
  items: z.array(stockInwardItemSchema).min(1, "At least one item is required."),
});

export const stockDamageItemSchema = z.object({
  productId: opaqueIdSchema,
  quantity: positiveInt,
  reasonCodeId: opaqueIdSchema,
});
export const stockDamageCreateSchema = z.object({
  warehouseId: opaqueIdSchema,
  notes: optionalString(1000),
  items: z.array(stockDamageItemSchema).min(1, "At least one item is required."),
});
export const stockDamageEditSchema = stockDamageCreateSchema;

export const stockBlockItemSchema = z.object({
  productId: opaqueIdSchema,
  quantityBlocked: positiveInt,
  reasonCodeId: opaqueIdSchema,
});
export const stockBlockCreateSchema = z.object({
  warehouseId: opaqueIdSchema,
  blockedDate: isoDateOnlySchema,
  reviewByDate: isoDateOnlySchema.optional().nullable(),
  items: z.array(stockBlockItemSchema).min(1, "At least one item is required."),
});
export const stockBlockEditSchema = stockBlockCreateSchema;
