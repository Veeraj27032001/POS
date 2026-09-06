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

export const ecommerceOrderLineSchema = z.object({
  productId: opaqueIdSchema,
  quantity: positiveInt,
  stockLockId: opaqueIdSchema.optional(),
});

// What the storefront told us about how the customer paid — recorded for
// staff to see on the pending order. This POS never processes the payment
// itself; it just trusts the caller that it already succeeded.
export const ecommerceOrderPaymentSchema = z.object({
  method: z.string().trim().min(1, "Payment method is required."),
  reference: optionalString(255),
  amount: z.number().positive(),
});

export const ecommerceOrderCreateSchema = z.object({
  orderDate: isoDateOnlySchema.optional(),
  // Which eligible store bills the order — defaults to the credential's own
  // store. Only meaningful when multi-store is enabled.
  storeId: opaqueIdSchema.optional(),
  customer: z.object({
    name: z.string().trim().min(1, "Customer name is required."),
    phone: phoneSchema,
    email: emailSchema.optional(),
    // Free-text shipping address — deliberately not a country/state FK pair
    // (that would need its own lookup endpoints for an external caller to
    // populate, and would collide with the FK-based fields tax resolution
    // already uses); this covers the common "where do we ship this" need
    // without that extra surface. All optional.
    address: optionalString(500),
    city: optionalString(100),
    taluk: optionalString(100),
    state: optionalString(100),
    country: optionalString(100),
    pincode: optionalString(20),
  }),
  lines: z.array(ecommerceOrderLineSchema).min(1, "At least one line is required."),
  payment: ecommerceOrderPaymentSchema.optional(),
});
