import { z } from "zod";

import {
  emailSchema,
  isoDateOnlySchema,
  opaqueIdSchema,
  optionalString,
  phoneSchema,
  positiveInt,
} from "@/lib/validation/common";

export const ecommerceStockLockCreateSchema = z.object({
  productId: opaqueIdSchema,
  // Which of the integration's eligible stores to lock at — defaults to the
  // credential's own store. Only meaningful when multi-store is enabled.
  storeId: opaqueIdSchema.optional(),
  warehouseId: opaqueIdSchema.optional(),
  quantity: positiveInt,
  externalReference: optionalString(255),
});

export const ecommerceBillLineSchema = z.object({
  productId: opaqueIdSchema,
  quantity: positiveInt,
  stockLockId: opaqueIdSchema.optional(),
});

export const ecommerceBillCreateSchema = z.object({
  billDate: isoDateOnlySchema.optional(),
  // Which eligible store bills the order — defaults to the credential's own
  // store. Only meaningful when multi-store is enabled.
  storeId: opaqueIdSchema.optional(),
  customer: z.object({
    name: z.string().trim().min(1, "Customer name is required."),
    phone: phoneSchema,
    email: emailSchema.optional(),
  }),
  lines: z.array(ecommerceBillLineSchema).min(1, "At least one line is required."),
});
