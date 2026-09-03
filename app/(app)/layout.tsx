"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Barcode,
  BarChart3,
  Boxes,
  CalendarRange,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardList,
  CreditCard,
  Hash,
  Landmark,
  LayoutDashboard,
  LineChart,
  Lock,
  Menu,
  Package,
  PackageOpen,
  PackagePlus,
  PackageX,
  Receipt,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  ShieldQuestion,
  ShoppingCart,
  Store,
  Tags,
  TrendingDown,
  TrendingUp,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  XIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
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
  "/bill-formats": "settings",
  "/numbering-series": "numbering_series",
  "/product-requests": "stock",
  "/stock-inwards": "stock",
  "/stock-damages": "stock",
  "/stock-blocks": "stock",
  "/stock-transfers": "stock",
  "/stock-quality-checks": "stock",
  "/stock-positive-adjustments": "stock",
  "/stock-negative-adjustments": "stock",
  "/stock-openings": "stock",
  "/entry-corrections": "stock",
  "/low-stock": "stock",
  "/billing": "billing",
  "/bills": "billing",
  "/bill-returns": "billing",
  "/credit-notes": "billing",
  "/refunds": "billing",
  "/shifts": "billing",
  "/reports/stock": "reports",
  "/reports/sales": "reports",
  "/settings/hsn-codes": "hsn_codes",
  "/settings/tax-engine": "stores",
  "/settings/financial-years": "financial_years",
  "/settings/roles": "roles",
};

const NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> }],
  },
  {
    label: "Billing",
    items: [
      { href: "/billing", label: "New Bill", icon: <ShoppingCart className="h-4 w-4" /> },
      { href: "/bills", label: "Bills", icon: <Receipt className="h-4 w-4" /> },
      {
        href: "/bill-returns",
        label: "Returns",
        icon: <ArrowLeftRight className="h-4 w-4" />,
      },
      {
        href: "/credit-notes",
        label: "Credit Notes",
        icon: <Undo2 className="h-4 w-4" />,
      },
      { href: "/refunds", label: "Refunds", icon: <Wallet className="h-4 w-4" /> },
      { href: "/shifts", label: "Shifts", icon: <ClipboardList className="h-4 w-4" /> },
    ],
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
        href: "/stock-openings",
        label: "Opening Balance",
        icon: <PackageOpen className="h-4 w-4" />,
      },
      {
        href: "/stock-positive-adjustments",
        label: "Positive Adjustment",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        href: "/stock-negative-adjustments",
        label: "Negative Adjustment",
        icon: <TrendingDown className="h-4 w-4" />,
      },
      {
        href: "/stock-quality-checks",
        label: "Quality Check",
        icon: <ClipboardCheck className="h-4 w-4" />,
      },
      {
        href: "/entry-corrections",
        label: "Entry Correction",
        icon: <ClipboardEdit className="h-4 w-4" />,
      },
      {
        href: "/low-stock",
        label: "Low Stock",
        icon: <AlertTriangle className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/stock", label: "Stock Report", icon: <BarChart3 className="h-4 w-4" /> },
      { href: "/reports/sales", label: "Sales Report", icon: <LineChart className="h-4 w-4" /> },
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
      { href: "/bill-formats", label: "Bill Formats", icon: <Receipt className="h-4 w-4" /> },
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
      {
        href: "/settings/financial-years",
        label: "Financial Years",
        icon: <CalendarRange className="h-4 w-4" />,
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
    <div className="flex h-screen overflow-hidden">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "bg-sidebar fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-hidden border-r backdrop-blur-xl transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-150",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 p-3 pb-4",
            collapsed && "md:justify-center",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="POS logo" className="size-7 shrink-0 rounded-lg object-cover" />
          {(!collapsed || mobileNavOpen) && (
            <span className="flex-1 text-[15px] font-extrabold">POS</span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:inline-flex"
          >
            <Menu className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="md:hidden"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 pt-0">
          <AppNav groups={visibleGroups} collapsed={collapsed && !mobileNavOpen} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-4 border-b px-6 py-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="md:hidden"
          >
            <Menu className="size-4" />
          </Button>
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

        <div className="shrink-0 border-b px-6 py-2.5">
          <Breadcrumbs />
        </div>

        <TaxStatusBanner />

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
