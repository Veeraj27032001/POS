import { decode, encode } from "next-auth/jwt";
import { cookies } from "next/headers";

import { env } from "@/lib/config/env";
import { unscoped } from "@/lib/db";

const SALT = "pos-storefront-customer";
const COOKIE_NAME = "storefront_customer";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface CustomerSessionPayload {
  customerId: string;
}

export async function issueCustomerSessionCookie(customerId: string): Promise<void> {
  const token = await encode<CustomerSessionPayload>({
    secret: env().AUTH_SECRET,
    salt: SALT,
    maxAge: MAX_AGE_SECONDS,
    token: { customerId },
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearCustomerSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getStorefrontCustomerId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const decoded = await decode<CustomerSessionPayload>({
    secret: env().AUTH_SECRET,
    salt: SALT,
    token,
  });
  return decoded?.customerId ?? null;
}

export async function getStorefrontCustomer() {
  const customerId = await getStorefrontCustomerId();
  if (!customerId) return null;
  return unscoped().customer.findUnique({ where: { id: customerId } });
}
