import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "./auth.config";
import { buildAuthRedirect } from "@/middleware/auth";
import { checkRbacAccess } from "@/middleware/rbac";
import { asAppSession } from "@/lib/auth/types";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = asAppSession(req.auth);

  const authRedirect = buildAuthRedirect(session, req);
  if (authRedirect) return authRedirect;

  if (session?.user) {
    const allowed = checkRbacAccess(req.nextUrl.pathname, session.user.permissions);
    if (!allowed) {
      const url = new URL("/forbidden", req.nextUrl);
      url.searchParams.set("path", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
