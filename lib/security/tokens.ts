import { randomBytes, randomUUID } from "node:crypto";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidOpaqueId(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

export function generateOpaqueId(): string {
  return randomUUID();
}

export function generatePublicToken(prefix: string): string {
  return `${prefix}_${randomBytes(18).toString("base64url")}`;
}

export function generateSecretToken(): string {
  return randomBytes(32).toString("base64url");
}
