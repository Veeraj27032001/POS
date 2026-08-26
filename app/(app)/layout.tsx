"use client";

import {
  Banknote,
  Barcode,
  Boxes,
  CreditCard,
  Hash,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Settings as SettingsIcon,
  ShieldCheck,
  ShieldQuestion,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { AppNav, type AppNavGroup } from "@/components/app-nav";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FinancialYearSwitcher } from "@/components/financial-year-switcher";
import { HeaderSearch } from "@/components/header-search";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { asAppSession } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: <Package className="h-4 w-4" /> },
      { href: "/categories", label: "Categories", icon: <Tags className="h-4 w-4" /> },
      { href: "/uoms", label: "Units of Measure", icon: <Boxes className="h-4 w-4" /> },
      { href: "/barcodes/system", label: "System Barcodes", icon: <Barcode className="h-4 w-4" /> },
      {
        href: "/barcodes/product",
        label: "Product Barcodes",
        icon: <Barcode className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/customers", label: "Customers", icon: <Users className="h-4 w-4" /> },
      { href: "/suppliers", label: "Suppliers", icon: <Truck className="h-4 w-4" /> },
      { href: "/users", label: "Users", icon: <UserCog className="h-4 w-4" /> },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/stores", label: "Stores", icon: <Store className="h-4 w-4" /> },
      { href: "/warehouses", label: "Warehouses", icon: <Warehouse className="h-4 w-4" /> },
      { href: "/terminals", label: "Terminals", icon: <Store className="h-4 w-4" /> },
      {
        href: "/payment-methods",
        label: "Payment Methods",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        href: "/reason-codes",
        label: "Reason Codes",
        icon: <ShieldQuestion className="h-4 w-4" />,
      },
      {
        href: "/cash-denominations",
        label: "Cash Denominations",
        icon: <Banknote className="h-4 w-4" />,
      },
      { href: "/numbering-series", label: "Numbering Series", icon: <Hash className="h-4 w-4" /> },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/tax", label: "Tax Settings", icon: <Landmark className="h-4 w-4" /> },
      { href: "/settings/security", label: "Security", icon: <ShieldCheck className="h-4 w-4" /> },
      {
        href: "/settings/preferences",
        label: "Preferences",
        icon: <SettingsIcon className="h-4 w-4" />,
      },
    ],
  },
];

const FLAT_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

const SIDEBAR_COLLAPSED_KEY = "pos:sidebar-collapsed";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const userName = session?.user?.name ?? "";
  const userRole = session?.user?.roleName ?? "";

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "bg-sidebar flex shrink-0 flex-col gap-1 overflow-y-auto border-r p-3 backdrop-blur-xl transition-[width] duration-150",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className={cn("flex items-center gap-2 px-1 pb-4", collapsed && "justify-center")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="POS logo" className="size-7 shrink-0 rounded-lg object-cover" />
          {!collapsed && <span className="flex-1 text-[15px] font-extrabold">POS</span>}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="size-4" />
          </Button>
        </div>

        <AppNav groups={NAV_GROUPS} collapsed={collapsed} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b px-6 py-3">
          <HeaderSearch items={FLAT_NAV_ITEMS} />
          <div className="flex-1" />
          <FinancialYearSwitcher />
          <ThemeToggle />

          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-full text-xs font-bold"
                  >
                    {initials(userName || "?")}
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-semibold">{userName}</div>
                    <div className="text-muted-foreground text-xs font-normal">{userRole}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<a href="/settings/security">Security</a>} />
                <DropdownMenuItem render={<a href="/settings/preferences">Preferences</a>} />
                <DropdownMenuSeparator />
                <div className="p-1">
                  <SignOutButton />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <div className="border-b px-6 py-2.5">
          <Breadcrumbs />
        </div>

        {children}
      </div>
    </div>
  );
}
