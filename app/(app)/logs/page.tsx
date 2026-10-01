"use client";

import { useSession } from "next-auth/react";

import { DataTable } from "@/components/data-table/data-table";
import { SUPER_ADMIN_ROLE_NAME } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { formatTimestamp } from "@/lib/datetime";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface AuditLogRow {
  id: string;
  createdAt: string;
  userName: string;
  roleName: string;
  storeName: string;
  action: string;
  entityType: string;
  entityId: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

function humanizeEntity(entityType: string): string {
  return entityType
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ActivityLogsPage() {
  const session = asAppSession(useSession().data);
  const isSuperAdmin = session?.user?.roleName === SUPER_ADMIN_ROLE_NAME;
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Activity Log</h1>
        <p className="text-muted-foreground text-sm">
          {isSuperAdmin
            ? "Every recorded action across all stores, newest first."
            : "Recorded actions for your store, newest first. Super Administrator activity is not listed."}
        </p>
      </div>

      <DataTable<AuditLogRow>
        resource="audit-logs"
        getRowId={(row) => row.id}
        emptyMessage="No activity recorded yet."
        columns={[
          {
            key: "createdAt",
            header: "When",
            render: (row) => formatTimestamp(row.createdAt),
          },
          { key: "userName", header: "User" },
          { key: "roleName", header: "Role" },
          ...(isSuperAdmin ? [{ key: "storeName", header: "Store" }] : []),
          {
            key: "action",
            header: "Action",
            render: (row) => ACTION_LABELS[row.action] ?? row.action,
          },
          {
            key: "entityType",
            header: "Record",
            render: (row) => humanizeEntity(row.entityType),
          },
        ]}
      />
    </div>
  );
}
