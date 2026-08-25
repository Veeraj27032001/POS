import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { AppSession } from "@/lib/auth/types";

const UNAUTHENTICATED_ONLY_PATHS = ["/login", "/mfa-verify", "/unauthorized"];
const FINANCIAL_YEAR_SELECTION_PATH = "/select-financial-year";

export function buildAuthRedirect(
  session: AppSession | null,
  request: NextRequest,
): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const isUnauthenticatedOnlyPath = UNAUTHENTICATED_ONLY_PATHS.some((p) => pathname.startsWith(p));
  const isFinancialYearPath = pathname.startsWith(FINANCIAL_YEAR_SELECTION_PATH);

  if (!session?.user) {
    if (isUnauthenticatedOnlyPath) return null;
    const url = new URL("/unauthorized", request.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isUnauthenticatedOnlyPath) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  if (!session.user.financialYearId) {
    if (isFinancialYearPath) return null;
    const url = new URL(FINANCIAL_YEAR_SELECTION_PATH, request.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isFinancialYearPath) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return null;
}
