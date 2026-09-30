import { z } from "zod";

import { isValidOpaqueId } from "@/lib/security/tokens";

export const opaqueIdSchema = z
  .string()
  .refine(isValidOpaqueId, { message: "Must be a valid identifier." });

export function requiredString(label: string, maxLength = 255) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`);
}

export function optionalString(maxLength = 255) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));
}

export const nonNegativeDecimal = z.coerce.number().min(0, "Must be zero or greater.");

export const positiveInt = z.coerce.number().int().positive("Must be a positive whole number.");

export const nonNegativeInt = z.coerce.number().int().min(0, "Must be zero or greater.");

export const isoDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format.");

export const emailSchema = z.string().trim().pipe(z.email("Must be a valid email address."));

// `.optional()` only excuses `undefined`, so a blank input ("") would still
// fail email-format validation and reject the whole payload.
export const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, {
    message: "Must be a valid email address.",
  });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{6,20}$/, "Must be a valid phone number.");

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[0-9+()\-\s]{6,20}$/.test(v), {
    message: "Must be a valid phone number.",
  });

// 15 chars: 2-digit state code, 10-char PAN, entity code, 'Z', checksum char.
// Format only — the mod-36 checksum is deliberately not enforced, so existing
// and test GSTINs stay accepted.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const optionalGstinSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v.toUpperCase() : null))
  .refine((v) => v === null || GSTIN_PATTERN.test(v), {
    message: "Must be a valid 15-character GSTIN, e.g. 29ABCDE1234F1Z5.",
  });

export const isActiveSchema = z.boolean().default(true);
