"use client";

import {
  ArrowLeftRight,
  Banknote,
  Barcode,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Hash,
  Landmark,
  LayoutDashboard,
  Lock,
  Menu,
  Package,
  PackagePlus,
  PackageX,
  Settings as SettingsIcon,
  Shield,
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
import { useEffect, useMemo, useState } from "react";

import { AppNav, type AppNavGroup } from "@/components/app-nav";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FinancialYearSwitcher } from "@/components/financial-year-switcher";
import { HeaderSearch } from "@/components/header-search";
import { SignOutButton } from "@/components/sign-out-button";
import { TaxStatusBanner } from "@/components/tax-status-banner";
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
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

// Items with no entry here (Dashboard, Security, Preferences) are always shown.
const NAV_ITEM_MODULE: Record<string, string> = {
  "/products": "products",
  "/categories": "categories",
  "/uoms": "settings",
  "/barcodes/system": "products",
  "/barcodes/product": "products",
  "/customers": "customers",
  "/suppliers": "suppliers",
  "/users": "users",
  "/stores": "stores",
  "/warehouses": "settings",
  "/terminals": "settings",
  "/payment-methods": "payment_methods",
  "/reason-codes": "reason_codes",
  "/cash-denominations": "settings",
  "/numbering-series": "numbering_series",
  "/product-requests": "stock",
  "/stock-inwards": "stock",
  "/stock-damages": "stock",
  "/stock-blocks": "stock",
  "/stock-transfers": "stock",
  "/stock-quality-checks": "stock",
  "/settings/hsn-codes": "hsn_codes",
  "/settings/tax-engine": "stores",
  "/settings/roles": "roles",
};

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
    label: "Stock",
    items: [
      {
        href: "/product-requests",
        label: "Product Requests",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: "/stock-inwards",
        label: "Stock Inward",
        icon: <PackagePlus className="h-4 w-4" />,
      },
      {
        href: "/stock-damages",
        label: "Stock Damage",
        icon: <PackageX className="h-4 w-4" />,
      },
      {
        href: "/stock-blocks",
        label: "Stock Block",
        icon: <Lock className="h-4 w-4" />,
      },
      {
        href: "/stock-transfers",
        label: "Stock Transfer",
        icon: <ArrowLeftRight className="h-4 w-4" />,
      },
      {
        href: "/stock-quality-checks",
        label: "Quality Check",
        icon: <ClipboardCheck className="h-4 w-4" />,
      },
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
      { href: "/settings/hsn-codes", label: "HSN Codes", icon: <Landmark className="h-4 w-4" /> },
      {
        href: "/settings/tax-engine",
        label: "Tax Engine",
        icon: <Landmark className="h-4 w-4" />,
      },
      { href: "/settings/roles", label: "Roles", icon: <Shield className="h-4 w-4" /> },
      { href: "/settings/security", label: "Security", icon: <ShieldCheck className="h-4 w-4" /> },
      {
        href: "/settings/preferences",
        label: "Preferences",
        icon: <SettingsIcon className="h-4 w-4" />,
      },
    ],
  },
];

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
  const permissions = session?.user?.permissions ?? [];

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const requiredModule = NAV_ITEM_MODULE[item.href];
        return !requiredModule || hasPermission(permissions, requiredModule, "view");
      }),
    })).filter((group) => group.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.join(",")]);

  const flatVisibleItems = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );

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

        <AppNav groups={visibleGroups} collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center gap-4 border-b px-6 py-3">
          <HeaderSearch items={flatVisibleItems} />
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

        <TaxStatusBanner />

        {children}
      </div>
    </div>
  );
}
