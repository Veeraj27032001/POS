"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

// Path segments that group sub-pages but have no index page of their own —
// rendering these as a Link would 404 (both on click and on Next.js's
// automatic viewport prefetch).
const NON_NAVIGABLE_SEGMENTS = new Set(["barcodes", "settings"]);

function humanize(segment: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return "Details";
  }
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-medium">Dashboard</span>;
  }

  let href = "";
  const crumbs = segments.map((segment) => {
    href += `/${segment}`;
    return { href, label: humanize(segment), navigable: !NON_NAVIGABLE_SEGMENTS.has(segment) };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
    >
      <Link href="/" className="hover:text-foreground">
        Dashboard
      </Link>
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.href}>
          <span className="text-border">/</span>
          {index === crumbs.length - 1 || !crumb.navigable ? (
            <span
              className={index === crumbs.length - 1 ? "text-foreground font-medium" : undefined}
            >
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
