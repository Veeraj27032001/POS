import type { User } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import type { Prisma } from "@/generated/prisma/client";
import { authConfig } from "./auth.config";
import { verifyEmailOtpChallenge } from "@/lib/auth/emailOtp";
import { verifyLoginTicket } from "@/lib/auth/loginTicket";
import { verifyTotpAgainstDevices } from "@/lib/auth/totp";
import { unscoped } from "@/lib/db";
import { permissionKey } from "@/lib/auth/rbac";
import { mfaTicketVerifySchema, ticketLoginSchema } from "@/lib/auth/schemas";
import type { AppUserClaims } from "@/lib/auth/types";

type AuthorizableUser = Prisma.UserGetPayload<{
  include: { role: { include: { roleRights: true } } };
}>;

async function buildAuthorizedUser(
  db: ReturnType<typeof unscoped>,
  user: AuthorizableUser,
): Promise<User & AppUserClaims> {
  const permissions = user.role.roleRights
    .filter((r) => r.allowed)
    .map((r) => permissionKey(r.module, r.action));

  await db.auditLog.create({
    data: {
      userId: user.id,
      storeId: user.storeId,
      action: "create",
      entityType: "session",
      entityId: user.id,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleName: user.role.name,
    storeId: user.storeId,
    permissions,
    financialYearId: null,
  } as User & AppUserClaims;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        ticket: {},
        code: {},
      },
      async authorize(rawCredentials) {
        const db = unscoped();

        const withCode = mfaTicketVerifySchema.safeParse(rawCredentials);
        if (withCode.success) {
          const ticketPayload = await verifyLoginTicket(withCode.data.ticket, "verify-mfa");
          if (!ticketPayload) return null;

          const user = await db.user.findUnique({
            where: { id: ticketPayload.userId },
            include: { role: { include: { roleRights: true } } },
          });
          if (!user || !user.isActive || !user.mfaMethod) return null;

          const codeValid =
            user.mfaMethod === "totp"
              ? await verifyTotpAgainstDevices(user.id, withCode.data.code)
              : await verifyEmailOtpChallenge(user.id, withCode.data.code);
          if (!codeValid) return null;

          return buildAuthorizedUser(db, user);
        }

        const withoutCode = ticketLoginSchema.safeParse(rawCredentials);
        if (!withoutCode.success) return null;

        const completeLoginPayload = await verifyLoginTicket(
          withoutCode.data.ticket,
          "complete-login",
        );
        if (!completeLoginPayload) return null;

        const user = await db.user.findUnique({
          where: { id: completeLoginPayload.userId },
          include: { role: { include: { roleRights: true } } },
        });
        if (!user || !user.isActive || user.mfaMethod) return null;

        return buildAuthorizedUser(db, user);
      },
    }),
  ],
});
