"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RBAC_ACTIONS, SUPER_ADMIN_ONLY_MODULES } from "@/lib/auth/rbac";

interface Right {
  module: string;
  action: string;
  allowed: boolean;
}

interface RoleDetail {
  id: string;
  name: string;
  roleRights: Right[];
}

const MODULE_LABELS: Record<string, string> = {
  products: "Products",
  categories: "Categories",
  customers: "Customers",
  suppliers: "Suppliers",
  stock: "Stock",
  billing: "Billing",
  discounts: "Discounts",
  reports: "Reports",
  users: "Users",
  roles: "Roles",
  settings: "Settings",
  stores: "Stores",
  numbering_series: "Numbering Series",
  reason_codes: "Reason Codes",
  payment_methods: "Payment Methods",
  tax_settings: "Tax Preferences",
  hsn_codes: "HSN Codes",
};

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [grid, setGrid] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  function refresh() {
    fetch(`/api/roles/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: RoleDetail) => {
        setRole(json);
        const next: Record<string, boolean> = {};
        for (const r of json.roleRights) next[`${r.module}:${r.action}`] = r.allowed;
        setGrid(next);
      })
      .catch(() => toast.error("Failed to load role."));
  }

  useEffect(refresh, [id]);

  if (!role) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-8 text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const modules = Array.from(new Set(role.roleRights.map((r) => r.module))).filter(
    (module) => !(SUPER_ADMIN_ONLY_MODULES as readonly string[]).includes(module),
  );

  async function handleSave() {
    setSaving(true);
    try {
      const rights = modules.flatMap((module) =>
        RBAC_ACTIONS.map((action) => ({
          module,
          action,
          allowed: grid[`${module}:${action}`] ?? false,
        })),
      );
      const res = await fetch(`/api/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rights }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save.");
        return;
      }
      refresh();
      toast.success("Role updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4 p-8">
      <div>
        <Link href="/settings/roles" className="text-muted-foreground text-sm hover:underline">
          ← Back to Roles
        </Link>
        <h1 className="text-2xl font-semibold">{role.name}</h1>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left font-medium">Module</th>
              {RBAC_ACTIONS.map((action) => (
                <th key={action} className="p-3 text-center font-medium capitalize">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr key={module} className="border-b last:border-0">
                <td className="p-3">{MODULE_LABELS[module] ?? module}</td>
                {RBAC_ACTIONS.map((action) => {
                  const key = `${module}:${action}`;
                  return (
                    <td key={action} className="p-3 text-center">
                      <Checkbox
                        checked={grid[key] ?? false}
                        onCheckedChange={(checked) =>
                          setGrid((prev) => ({ ...prev, [key]: checked === true }))
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2Icon className="size-3.5 animate-spin" />}
        Save
      </Button>
    </div>
  );
}
