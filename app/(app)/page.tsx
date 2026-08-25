"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
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

  const [greetingText, setGreetingText] = useState("Hello");
  useEffect(() => {
    setGreetingText(greeting());
  }, []);

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
