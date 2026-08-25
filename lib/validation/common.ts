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

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{6,20}$/, "Must be a valid phone number.");

export const isActiveSchema = z.boolean().default(true);
