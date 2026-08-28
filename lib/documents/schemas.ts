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
  status: z.enum(["sent", "cancelled"]),
});

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
