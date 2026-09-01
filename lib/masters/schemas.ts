import { z } from "zod";

import { billTypeSchema } from "@/lib/billing/schemas";
import { billFormatDesignSchema } from "@/lib/billing/billFormatDesign.types";
import { SERIES_TYPES } from "@/lib/numbering/seriesDefaults";
import {
  emailSchema,
  isoDateOnlySchema,
  nonNegativeDecimal,
  nonNegativeInt,
  opaqueIdSchema,
  optionalPhoneSchema,
  optionalString,
  phoneSchema,
  requiredString,
} from "@/lib/validation/common";

export const hsnCodeCreateSchema = z.object({
  hsnCode: requiredString("HSN code", 32),
  description: requiredString("Description"),
  cgstRate: nonNegativeDecimal,
  sgstRate: nonNegativeDecimal,
  igstRate: nonNegativeDecimal,
  isActive: z.boolean().default(true),
});
export const hsnCodeUpdateSchema = hsnCodeCreateSchema.partial();

export const hsnCodeImportSchema = z.object({
  rows: z
    .array(
      z.object({
        id: opaqueIdSchema.optional(),
        hsnCode: requiredString("HSN code", 32),
        description: requiredString("Description"),
        cgstRate: nonNegativeDecimal,
        sgstRate: nonNegativeDecimal,
        igstRate: nonNegativeDecimal,
      }),
    )
    .min(1, "The file has no rows to import."),
});

export const categoryCreateSchema = z.object({
  name: requiredString("Name"),
  parentCategoryId: opaqueIdSchema.optional().nullable(),
  isActive: z.boolean().default(true),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const uomCreateSchema = z.object({
  name: requiredString("Name"),
  abbreviation: requiredString("Abbreviation", 16),
  baseUomId: opaqueIdSchema.optional().nullable(),
  conversionFactor: nonNegativeDecimal.optional().nullable(),
});
export const uomUpdateSchema = uomCreateSchema.partial();

export const productCreateSchema = z.object({
  name: requiredString("Name"),
  categoryId: opaqueIdSchema.optional().nullable(),
  hsnCodeId: opaqueIdSchema.optional().nullable(),
  images: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
  description: optionalString(2000),
  packSize: nonNegativeDecimal.optional().nullable(),
  uomId: opaqueIdSchema,
  skuBarcode: optionalString(64),
  price: nonNegativeDecimal,
  stockTracked: z.boolean().default(true),
  reorderLevel: nonNegativeInt.optional().nullable(),
  defaultCostPrice: nonNegativeDecimal.optional().nullable(),
  isActive: z.boolean().default(true),
});
export const productUpdateSchema = productCreateSchema.partial();

export const productSupplierPriceCreateSchema = z.object({
  supplierId: opaqueIdSchema,
  cost: nonNegativeDecimal,
});

export const customerCreateSchema = z.object({
  name: requiredString("Name"),
  phone: optionalPhoneSchema,
  email: emailSchema.optional().nullable(),
  address: optionalString(500),
  countryId: opaqueIdSchema.optional().nullable(),
  stateId: opaqueIdSchema.optional().nullable(),
  pincode: optionalString(20),
  taxId: optionalString(32),
  creditLimit: nonNegativeDecimal.optional().nullable(),
  loyaltyPoints: nonNegativeInt.optional().nullable(),
  storeIds: z.array(opaqueIdSchema).min(1, "Select at least one store."),
  isActive: z.boolean().default(true),
});
export const customerUpdateSchema = customerCreateSchema.partial();

export const supplierCreateSchema = z.object({
  name: requiredString("Name"),
  contactPhone: phoneSchema.optional().nullable(),
  contactEmail: emailSchema.optional().nullable(),
  address: optionalString(500),
  countryId: opaqueIdSchema.optional().nullable(),
  stateId: opaqueIdSchema.optional().nullable(),
  taxId: optionalString(32),
  paymentTerms: optionalString(100),
  storeIds: z.array(opaqueIdSchema).min(1, "Select at least one store."),
  isActive: z.boolean().default(true),
});
export const supplierUpdateSchema = supplierCreateSchema.partial();

export const warehouseCreateSchema = z.object({
  name: requiredString("Name"),
  address: requiredString("Address"),
  countryId: opaqueIdSchema.optional().nullable(),
  stateId: opaqueIdSchema.optional().nullable(),
  storeId: opaqueIdSchema.optional().nullable(),
  isActive: z.boolean().default(true),
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const terminalCreateSchema = z.object({
  name: requiredString("Name"),
  storeId: opaqueIdSchema,
  deviceIdentifier: optionalString(128),
  isActive: z.boolean().default(true),
});
export const terminalUpdateSchema = terminalCreateSchema.partial();

export const paymentMethodTypeSchema = z.enum([
  "cash",
  "card",
  "digital_wallet",
  "bank_transfer",
  "other",
]);
export const paymentMethodCreateSchema = z.object({
  name: requiredString("Name"),
  type: paymentMethodTypeSchema,
  requiresReference: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const paymentMethodUpdateSchema = paymentMethodCreateSchema.partial();

export const priceListCreateSchema = z.object({
  name: requiredString("Name"),
  storeId: opaqueIdSchema.optional().nullable(),
  effectiveFrom: isoDateOnlySchema.optional().nullable(),
  effectiveTo: isoDateOnlySchema.optional().nullable(),
});
export const priceListUpdateSchema = priceListCreateSchema.partial();

export const priceListItemCreateSchema = z.object({
  priceListId: opaqueIdSchema,
  productId: opaqueIdSchema,
  price: nonNegativeDecimal,
});
export const priceListItemUpdateSchema = priceListItemCreateSchema
  .omit({ priceListId: true, productId: true })
  .partial();

export const discountTypeSchema = z.enum(["percent", "flat"]);
export const discountAppliesToSchema = z.enum(["product", "category", "all"]);
export const discountCreateSchema = z.object({
  name: requiredString("Name"),
  type: discountTypeSchema,
  value: nonNegativeDecimal,
  appliesTo: discountAppliesToSchema,
  productId: opaqueIdSchema.optional().nullable(),
  categoryId: opaqueIdSchema.optional().nullable(),
  couponCode: optionalString(32),
  effectiveFrom: isoDateOnlySchema.optional().nullable(),
  effectiveTo: isoDateOnlySchema.optional().nullable(),
  isActive: z.boolean().default(true),
});
export const discountUpdateSchema = discountCreateSchema.partial();

export const reasonCodeCategorySchema = z.enum([
  "return",
  "void",
  "discount",
  "stock_adjustment",
  "damage",
  "stock_block",
  "quality_check",
]);
export const reasonCodeCreateSchema = z.object({
  category: reasonCodeCategorySchema,
  label: requiredString("Label"),
  isActive: z.boolean().default(true),
});
export const reasonCodeUpdateSchema = reasonCodeCreateSchema.partial();

export const denominationTypeSchema = z.enum(["note", "coin"]);
export const cashDenominationCreateSchema = z.object({
  value: nonNegativeDecimal,
  type: denominationTypeSchema,
  storeId: opaqueIdSchema,
  currencyId: opaqueIdSchema,
  isActive: z.boolean().default(true),
});
export const cashDenominationUpdateSchema = cashDenominationCreateSchema.partial();

export const billFormatKindSchema = z.enum(["receipt", "bill", "credit_note", "refund"]);
export const billFormatCreateSchema = z.object({
  storeId: opaqueIdSchema,
  billType: billTypeSchema,
  formatKind: billFormatKindSchema,
  name: requiredString("Name"),
  effectiveFrom: isoDateOnlySchema,
  templateHtml: requiredString("Template HTML", 200000),
  designJson: billFormatDesignSchema.nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const billFormatUpdateSchema = billFormatCreateSchema.partial();

export const loyaltyRuleCreateSchema = z.object({
  storeId: opaqueIdSchema.optional().nullable(),
  earnRate: nonNegativeDecimal,
  redeemRate: nonNegativeDecimal,
  minRedeemPoints: nonNegativeInt.optional().nullable(),
  effectiveFrom: isoDateOnlySchema.optional().nullable(),
  effectiveTo: isoDateOnlySchema.optional().nullable(),
  isActive: z.boolean().default(true),
});
export const loyaltyRuleUpdateSchema = loyaltyRuleCreateSchema.partial();

export const apiCredentialCreateSchema = z.object({
  label: requiredString("Label"),
});
export const apiCredentialUpdateSchema = z.object({
  label: requiredString("Label").optional(),
  isActive: z.boolean().optional(),
});

export const storeCreateSchema = z.object({
  name: requiredString("Name"),
  address: requiredString("Address"),
  countryId: opaqueIdSchema.optional().nullable(),
  stateId: opaqueIdSchema.optional().nullable(),
  taxRegionId: opaqueIdSchema.optional().nullable(),
  taxEngineId: opaqueIdSchema.optional().nullable(),
  defaultExcludeTax: z.boolean().default(false),
  timezoneId: opaqueIdSchema.optional().nullable(),
  currencyId: opaqueIdSchema.optional().nullable(),
  gstin: optionalString(15),
  logoUrl: optionalString(500),
  receiptHeaderText: optionalString(500),
  receiptFooterText: optionalString(500),
  returnPolicyText: optionalString(2000),
  isActive: z.boolean().default(true),
});
export const storeUpdateSchema = storeCreateSchema.partial();

export const userCreateSchema = z.object({
  name: requiredString("Name"),
  email: emailSchema,
  phone: phoneSchema.optional().nullable(),
  password: requiredString("Password", 200),
  roleId: opaqueIdSchema,
  storeId: opaqueIdSchema.optional().nullable(),
  isActive: z.boolean().default(true),
});
export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial();

export const financialYearCreateSchema = z.object({
  label: requiredString("Label", 20),
  startDate: isoDateOnlySchema,
  endDate: isoDateOnlySchema,
  isActive: z.boolean().default(true),
});
export const financialYearUpdateSchema = financialYearCreateSchema.partial();

export const seriesTypeSchema = z.enum(SERIES_TYPES);
export const numberingSeriesCreateSchema = z.object({
  seriesType: seriesTypeSchema,
  storeId: opaqueIdSchema,
  financialYearId: opaqueIdSchema,
  prefix: optionalString(16),
  currentNumber: nonNegativeInt.default(0),
  isActive: z.boolean().default(true),
});
export const numberingSeriesCopyToAllStoresSchema = z.object({
  sourceStoreId: opaqueIdSchema,
});
export const numberingSeriesUpdateSchema = z.object({
  prefix: optionalString(16),
  currentNumber: nonNegativeInt.optional(),
  isActive: z.boolean().optional(),
});
