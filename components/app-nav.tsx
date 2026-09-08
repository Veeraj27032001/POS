"use client";

import { Loader2Icon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

function NavLinkPendingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2Icon className="ml-auto size-3.5 shrink-0 animate-spin" />;
}

export interface AppNavItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export interface AppNavGroup {
  label: string;
  items: AppNavItem[];
}

export interface AppNavProps {
  groups: AppNavGroup[];
  collapsed?: boolean;
}

export function AppNav({ groups, collapsed = false }: AppNavProps) {
  const pathname = usePathname();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const flatItems = groups.flatMap((group) => group.items);

  // Keeps keyboard nav oriented on wherever you actually are. Billing is a
  // deliberate exception — it keeps its own scan-box autofocus for a
  // physical barcode scanner, so this effect leaves that page alone rather
  // than racing it for focus.
  useEffect(() => {
    if (pathname === "/billing") return;
    const idx = flatItems.findIndex((item) => item.href === pathname);
    if (idx >= 0) itemRefs.current[idx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, groups]);

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(flatItems.length - 1, index + 1);
      itemRefs.current[next]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(0, index - 1);
      itemRefs.current[prev]?.focus();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const item = flatItems[index];
      if (item.href === pathname) {
        document.querySelector<HTMLElement>("main [data-kbd-item]")?.focus();
      } else {
        itemRefs.current[index]?.click();
      }
    }
  }

  let flatIndex = -1;

  return (
    <nav aria-label="Main navigation" className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <div className="text-muted-foreground px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              {group.label}
            </div>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              flatIndex += 1;
              const index = flatIndex;
              return (
                <li key={item.href}>
                  <Link
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={cn(
                      "focus-visible:ring-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2",
                      collapsed && "justify-center px-0",
                      pathname === item.href
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-accent/50",
                    )}
                  >
                    {item.icon}
                    {!collapsed && item.label}
                    {!collapsed && <NavLinkPendingIndicator />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
