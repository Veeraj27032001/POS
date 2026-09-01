import { z } from "zod";

import {
  emailSchema,
  isoDateOnlySchema,
  nonNegativeDecimal,
  nonNegativeInt,
  opaqueIdSchema,
  optionalPhoneSchema,
  optionalString,
  positiveInt,
} from "@/lib/validation/common";

export const billTypeSchema = z.enum(["cash_bill", "credit_bill", "online_bill"]);

export const billCreateSchema = z.object({
  billType: billTypeSchema,
  billDate: isoDateOnlySchema,
  terminalId: opaqueIdSchema,
  customerId: opaqueIdSchema.optional().nullable(),
  excludeTax: z.boolean().default(false),
});

export const billAttachCustomerSchema = z.object({
  customerId: opaqueIdSchema.optional().nullable(),
  billDate: isoDateOnlySchema.optional(),
  terminalId: opaqueIdSchema.optional(),
});

export const billLineAllocationSchema = z.object({
  warehouseId: opaqueIdSchema,
  quantity: positiveInt,
});

export const billLineAddSchema = z.object({
  productId: opaqueIdSchema,
  quantity: positiveInt.optional(),
  allocations: z.array(billLineAllocationSchema).optional(),
});

export const billLineQuantitySchema = z.object({
  quantity: positiveInt,
  allocations: z.array(billLineAllocationSchema).optional(),
});

export const billLineDiscountSchema = z.object({
  discountApplied: z.coerce.number().min(0, "Must be zero or greater."),
  discountReasonCodeId: opaqueIdSchema.optional().nullable(),
});

export const billDiscountSchema = z.object({
  overallDiscount: z.coerce.number().min(0, "Must be zero or greater."),
  discountReasonCodeId: opaqueIdSchema.optional().nullable(),
});

// Billing's own customer detail fields — deliberately more permissive than
// the Customers master's own createSchema (lib/masters/schemas.ts), which
// keeps requiring Name. Same underlying `customers` table either way: these
// are plain billing-detail fields that sync to whichever customer record is
// currently attached to the bill (creating one on first meaningful input).
export const billCustomerDetailsSchema = z.object({
  name: optionalString(255),
  phone: optionalPhoneSchema,
  email: emailSchema.optional().nullable(),
  address: optionalString(500),
  countryId: opaqueIdSchema.optional().nullable(),
  stateId: opaqueIdSchema.optional().nullable(),
  pincode: optionalString(20),
});

// Preview: computes totals (including real GST tax rules) for a cart that
// hasn't been saved anywhere yet — a pure read, no bill/lines/reservation
// created. Line items are keyed by productId directly rather than a real
// line id, since none exists until the cart is actually submitted.
export const billPreviewSchema = z.object({
  billId: opaqueIdSchema.optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: opaqueIdSchema,
        quantity: positiveInt,
        discountApplied: z.coerce.number().min(0, "Must be zero or greater.").default(0),
        allocations: z.array(billLineAllocationSchema).optional(),
      }),
    )
    .default([]),
  overallDiscount: z.coerce.number().min(0, "Must be zero or greater.").default(0),
  customerStateId: opaqueIdSchema.optional().nullable(),
  excludeTax: z.boolean().default(false),
});

export const billCancelSchema = z.object({
  reasonCodeId: opaqueIdSchema,
});

export const billPaymentCreateSchema = z.object({
  paymentMethodId: opaqueIdSchema,
  amount: z.coerce.number().positive("Must be a positive amount."),
  referenceNumber: optionalString(100),
});

export const billReturnLineCreateSchema = z.object({
  billLineId: opaqueIdSchema,
  quantity: positiveInt,
  condition: z.enum(["sellable", "damaged"]),
  warehouseId: opaqueIdSchema,
});

export const billReturnCreateSchema = z.object({
  reasonCodeId: opaqueIdSchema,
  lines: z.array(billReturnLineCreateSchema).min(1, "Add at least one line to return."),
});

export const refundCreateSchema = z.object({
  refundMethodId: opaqueIdSchema,
  amount: z.coerce.number().positive("Must be a positive amount."),
});

export const shiftCashCountEntrySchema = z.object({
  denominationId: opaqueIdSchema,
  quantityCounted: nonNegativeInt,
});

export const shiftOpenSchema = z.object({
  terminalId: opaqueIdSchema,
  openingFloat: nonNegativeDecimal,
  openingCounts: z.array(shiftCashCountEntrySchema).optional(),
});

export const shiftCloseSchema = z.object({
  closingCounted: nonNegativeDecimal,
  closingCounts: z.array(shiftCashCountEntrySchema).optional(),
});
