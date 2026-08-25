import { decode, encode } from "next-auth/jwt";

import { env } from "@/lib/config/env";

const SALT = "pos-login-ticket";

export type LoginTicketPurpose = "complete-login" | "verify-mfa";

export interface LoginTicketPayload {
  userId: string;
  purpose: LoginTicketPurpose;
}

export async function issueLoginTicket(
  payload: LoginTicketPayload,
  maxAgeSeconds: number,
): Promise<string> {
  return encode({
    secret: env().AUTH_SECRET,
    salt: SALT,
    maxAge: maxAgeSeconds,
    token: payload,
  });
}

export async function verifyLoginTicket(
  ticket: string,
  expectedPurpose: LoginTicketPurpose,
): Promise<LoginTicketPayload | null> {
  const decoded = await decode<LoginTicketPayload>({
    secret: env().AUTH_SECRET,
    salt: SALT,
    token: ticket,
  });
  if (!decoded || decoded.purpose !== expectedPurpose || !decoded.userId) return null;
  return decoded;
}
