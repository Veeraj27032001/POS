import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

import type { AppSessionUser, AppUserClaims } from "@/lib/auth/types";

type AppJwt = JWT & { userId: string } & AppUserClaims;

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      const appToken = token as AppJwt;

      if (user) {
        const appUser = user as unknown as { id: string } & AppUserClaims;
        appToken.userId = appUser.id;
        appToken.roleId = appUser.roleId;
        appToken.roleName = appUser.roleName;
        appToken.storeId = appUser.storeId;
        appToken.permissions = appUser.permissions;
        appToken.financialYearId = appUser.financialYearId;
      }

      if (trigger === "update" && session && "financialYearId" in session) {
        appToken.financialYearId = (session as { financialYearId: string | null }).financialYearId;
      }

      return appToken;
    },
    session({ session, token }) {
      const appToken = token as AppJwt;
      const appUser = session.user as unknown as AppSessionUser;
      appUser.id = appToken.userId;
      appUser.roleId = appToken.roleId;
      appUser.roleName = appToken.roleName;
      appUser.storeId = appToken.storeId;
      appUser.financialYearId = appToken.financialYearId;
      appUser.permissions = appToken.permissions;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
