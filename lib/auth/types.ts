import type { Session } from "next-auth";

export interface AppUserClaims {
  roleId: string;
  roleName: string;
  storeId: string | null;
  financialYearId: string | null;
  permissions: string[];
}

export type AppSessionUser = Session["user"] & { id: string } & AppUserClaims;

export type AppSession = Omit<Session, "user"> & { user: AppSessionUser };

export function asAppSession(session: Session | null): AppSession | null {
  return session as AppSession | null;
}
