import { z } from "zod";

import { opaqueIdSchema, optionalString, positiveInt } from "@/lib/validation/common";

export const billTypeSchema = z.enum(["cash_bill", "credit_bill", "online_bill"]);

export const billCreateSchema = z.object({
  billType: billTypeSchema,
  terminalId: opaqueIdSchema,
  customerId: opaqueIdSchema.optional().nullable(),
});

export const billLineAllocationSchema = z.object({
  warehouseId: opaqueIdSchema,
  quantity: positiveInt,
});

export const billLineAddSchema = z.object({
  productId: opaqueIdSchema,
  allocations: z.array(billLineAllocationSchema).optional(),
});

export const billLineQuantitySchema = z.object({
  quantity: positiveInt,
  allocations: z.array(billLineAllocationSchema).optional(),
});

export const billLineDiscountSchema = z.object({
  discountApplied: z.coerce.number().min(0, "Must be zero or greater."),
  discountReasonCodeId: opaqueIdSchema,
});

export const billPaymentCreateSchema = z.object({
  paymentMethodId: opaqueIdSchema,
  amount: z.coerce.number().positive("Must be a positive amount."),
  referenceNumber: optionalString(100),
});
