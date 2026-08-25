import { z } from "zod";

import { emailSchema, requiredString } from "@/lib/validation/common";

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: requiredString("Password", 200),
});

export const ticketLoginSchema = z.object({
  ticket: requiredString("Ticket", 2000),
});

const sixDigitCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Must be a 6-digit code.");

export const mfaTicketVerifySchema = z.object({
  ticket: requiredString("Ticket", 2000),
  code: sixDigitCode,
});

export const mfaVerifySchema = z.object({
  secret: requiredString("Secret", 128),
  code: sixDigitCode,
});

export const mfaDeviceCreateSchema = z.object({
  secret: requiredString("Secret", 128),
  code: sixDigitCode,
  label: requiredString("Label", 100),
});

export const mfaCodeSchema = z.object({
  code: sixDigitCode,
});

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type TicketLoginInput = z.infer<typeof ticketLoginSchema>;
export type MfaTicketVerifyInput = z.infer<typeof mfaTicketVerifySchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaDeviceCreateInput = z.infer<typeof mfaDeviceCreateSchema>;
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;
