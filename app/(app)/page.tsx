"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatRelativeOrAbsolute } from "@/lib/datetime";
import { asAppSession } from "@/lib/auth/types";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useListCount } from "@/lib/pagination/useList";

interface ActivityEntry {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  createdAt: string;
}

interface DashboardSummary {
  hasStore: boolean;
  todaySales?: {
    byType: Record<"cash_bill" | "credit_bill" | "online_bill", number>;
    countByType: Record<"cash_bill" | "credit_bill" | "online_bill", number>;
    totalRevenue: number;
    totalBills: number;
  };
  lowStock?: {
    count: number;
    items: { productId: string; productName: string; available: number; reorderLevel: number }[];
  };
  staleBlocks?: {
    count: number;
    items: { id: string; productName: string; quantityBlocked: number }[];
  };
  staleHeldBills?: {
    count: number;
    items: { id: string; documentNumber: string; heldAt: string | null }[];
  };
  pendingTransfers?: { incoming: number; outgoing: number };
  creditOutstanding?: { total: number; billCount: number };
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash",
  credit_bill: "Credit",
  online_bill: "Online",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function actionLabel(entry: ActivityEntry): string {
  const entity = entry.entityType.replace(/_/g, " ");
  if (entry.action === "create") return `created a ${entity}`;
  if (entry.action === "delete") return `deactivated a ${entity}`;
  return `updated a ${entity}`;
}

const QUICK_ACTIONS = [
  { href: "/products", label: "Add a product" },
  { href: "/customers", label: "Add a customer" },
  { href: "/categories", label: "Add a category" },
  { href: "/suppliers", label: "Add a supplier" },
];

export default function DashboardPage() {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const currencySymbol = useStoreCurrencySymbol();

  const [greetingText, setGreetingText] = useState("Hello");
  useEffect(() => {
    setGreetingText(greeting());
  }, []);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) throw new Error("Failed to load the dashboard summary.");
      return (await res.json()) as DashboardSummary;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const summary = summaryQuery.data;

  const widgetsRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-navcard]", cols: 3 });

  const productsCount = useListCount({ resource: "products", pageSize: 1 });
  const customersCount = useListCount({ resource: "customers", pageSize: 1 });
  const suppliersCount = useListCount({ resource: "suppliers", pageSize: 1 });
  const usersCount = useListCount({ resource: "users", pageSize: 1 });

  const activityQuery = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/recent-activity");
      if (!res.ok) throw new Error("Failed to load recent activity.");
      return (await res.json()) as { entries: ActivityEntry[] };
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const statCardsRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-navcard]", cols: 4 });
  const activityRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-navcard]", cols: 1 });
  const quickActionsRef = useArrowKeyNav<HTMLDivElement>({ selector: "[data-navcard]", cols: 1 });

  const stats = [
    { label: "Products", value: productsCount.data?.totalRecords },
    { label: "Customers", value: customersCount.data?.totalRecords },
    { label: "Suppliers", value: suppliersCount.data?.totalRecords },
    { label: "Users", value: usersCount.data?.totalRecords },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">
        {greetingText}, {session?.user?.name?.split(" ")[0] ?? "there"}
      </h1>
      <p className="text-muted-foreground mb-1 text-sm">
        Here&apos;s what&apos;s happening across your store today.
      </p>
      <p className="text-muted-foreground mb-6 text-xs">
        Signed in as {session?.user?.name} ({session?.user?.roleName})
      </p>

      {summary?.hasStore && (
        <div ref={widgetsRef} className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <CardContent>
              <p className="mb-2 text-sm font-bold">Today&apos;s Sales</p>
              <p className="text-2xl font-extrabold">
                {currencySymbol}
                {(summary.todaySales?.totalRevenue ?? 0).toFixed(2)}
              </p>
              <p className="text-muted-foreground mb-3 text-xs">
                {summary.todaySales?.totalBills ?? 0} bill
                {summary.todaySales?.totalBills === 1 ? "" : "s"}
              </p>
              <div className="text-muted-foreground space-y-1 text-xs">
                {(["cash_bill", "credit_bill", "online_bill"] as const).map((type) => (
                  <div key={type} className="flex justify-between">
                    <span>{BILL_TYPE_LABELS[type]}</span>
                    <span>
                      {currencySymbol}
                      {(summary.todaySales?.byType[type] ?? 0).toFixed(2)} (
                      {summary.todaySales?.countByType[type] ?? 0})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Link
            href="/low-stock"
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring block rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Card className="h-full transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent>
                <p className="mb-2 text-sm font-bold">Low Stock Alerts</p>
                <p className="text-2xl font-extrabold">{summary.lowStock?.count ?? 0}</p>
                <p className="text-muted-foreground mb-3 text-xs">
                  products at/below reorder level
                </p>
                <ul className="space-y-1 text-xs">
                  {summary.lowStock?.items.map((item) => (
                    <li key={item.productId} className="flex justify-between gap-2">
                      <span className="truncate">{item.productName}</span>
                      <span className="text-muted-foreground shrink-0">
                        {item.available}/{item.reorderLevel}
                      </span>
                    </li>
                  ))}
                  {summary.lowStock?.count === 0 && (
                    <li className="text-muted-foreground">All good.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link
            href="/stock-blocks/stale"
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring block rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Card className="h-full transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent>
                <p className="mb-2 text-sm font-bold">Stale Stock Blocks</p>
                <p className="text-2xl font-extrabold">{summary.staleBlocks?.count ?? 0}</p>
                <p className="text-muted-foreground mb-3 text-xs">past their review date</p>
                <ul className="space-y-1 text-xs">
                  {summary.staleBlocks?.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.productName}</span>
                      <span className="text-muted-foreground shrink-0">{item.quantityBlocked}</span>
                    </li>
                  ))}
                  {summary.staleBlocks?.count === 0 && (
                    <li className="text-muted-foreground">Nothing stale.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link
            href="/billing/held"
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring block rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Card className="h-full transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent>
                <p className="mb-2 text-sm font-bold">Stale Held Bills</p>
                <p className="text-2xl font-extrabold">{summary.staleHeldBills?.count ?? 0}</p>
                <p className="text-muted-foreground mb-3 text-xs">held too long</p>
                <ul className="space-y-1 text-xs">
                  {summary.staleHeldBills?.items.map((bill) => (
                    <li key={bill.id} className="flex justify-between gap-2">
                      <span className="truncate">{bill.documentNumber}</span>
                      <span className="text-muted-foreground shrink-0">
                        {bill.heldAt ? formatRelativeOrAbsolute(bill.heldAt).display : "—"}
                      </span>
                    </li>
                  ))}
                  {summary.staleHeldBills?.count === 0 && (
                    <li className="text-muted-foreground">Nothing stale.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </Link>

          <Link
            href="/stock-transfers"
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring block rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Card className="h-full transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent>
                <p className="mb-2 text-sm font-bold">Pending Transfers</p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-extrabold">
                      {summary.pendingTransfers?.incoming ?? 0}
                    </p>
                    <p className="text-muted-foreground text-xs">Incoming</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold">
                      {summary.pendingTransfers?.outgoing ?? 0}
                    </p>
                    <p className="text-muted-foreground text-xs">Outgoing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link
            href="/reports/credit-outstanding"
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring block rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Card className="h-full transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent>
                <p className="mb-2 text-sm font-bold">Credit Bill Outstanding</p>
                <p className="text-2xl font-extrabold">
                  {currencySymbol}
                  {(summary.creditOutstanding?.total ?? 0).toFixed(2)}
                </p>
                <p className="text-muted-foreground text-xs">
                  across {summary.creditOutstanding?.billCount ?? 0} unsettled credit bill
                  {summary.creditOutstanding?.billCount === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div ref={statCardsRef} className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            tabIndex={0}
            data-navcard
            className="focus-visible:outline-ring transition-[transform,box-shadow] outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <CardContent>
              <p className="text-muted-foreground mb-2 text-xs font-semibold">{stat.label}</p>
              <p className="text-2xl font-extrabold">{stat.value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-bold">Recent activity</p>
            <div ref={activityRef} className="divide-y">
              {activityQuery.data?.entries.length === 0 && (
                <p className="text-muted-foreground py-4 text-sm">No activity yet.</p>
              )}
              {activityQuery.data?.entries.map((entry) => (
                <div
                  key={entry.id}
                  tabIndex={0}
                  data-navcard
                  className="focus-visible:bg-accent hover:bg-accent flex items-center gap-3 rounded-lg px-2 py-3 outline-none"
                >
                  <div className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {initials(entry.userName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.userName} {actionLabel(entry)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeOrAbsolute(entry.createdAt).display}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-bold">Quick actions</p>
            <div ref={quickActionsRef} className="flex flex-col gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  data-navcard
                  className="bg-secondary hover:bg-accent focus-visible:outline-ring rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
