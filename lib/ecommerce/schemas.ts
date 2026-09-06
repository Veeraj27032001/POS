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
  warehouseId: opaqueIdSchema.optional(),
  quantity: positiveInt,
  externalReference: optionalString(255),
});

export const ecommerceBillLineSchema = z.object({
  productId: opaqueIdSchema,
  warehouseId: opaqueIdSchema,
  quantity: positiveInt,
  stockLockId: opaqueIdSchema.optional(),
});

export const ecommerceBillCreateSchema = z.object({
  billDate: isoDateOnlySchema.optional(),
  customer: z.object({
    name: z.string().trim().min(1, "Customer name is required."),
    phone: phoneSchema,
    email: emailSchema.optional(),
  }),
  lines: z.array(ecommerceBillLineSchema).min(1, "At least one line is required."),
});
