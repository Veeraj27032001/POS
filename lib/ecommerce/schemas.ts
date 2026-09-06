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
    // Free-text shipping address — deliberately not a country/state FK pair
    // (that would need its own lookup endpoints for an external caller to
    // populate); this covers the common "where do we ship this" need
    // without that extra surface.
    address: optionalString(500),
    pincode: optionalString(20),
  }),
  lines: z.array(ecommerceBillLineSchema).min(1, "At least one line is required."),
});
