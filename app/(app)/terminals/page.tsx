"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { terminalCreateSchema, terminalUpdateSchema } from "@/lib/masters/schemas";

interface TerminalRow {
  id: string;
  name: string;
  deviceIdentifier: string | null;
  isActive: boolean;
}

export default function TerminalsPage() {
  return (
    <ResourcePage<
      TerminalRow,
      z.infer<typeof terminalCreateSchema>,
      z.infer<typeof terminalUpdateSchema>
    >
      resource="terminals"
      title="Terminals"
      columns={[
        { key: "name", header: "Name" },
        { key: "deviceIdentifier", header: "Device" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        {
          name: "storeId",
          label: "Store",
          type: "select",
          optionsResource: "stores/options",
          placeholder: "Select store…",
        },
        { name: "deviceIdentifier", label: "Device identifier", type: "text" },
      ]}
      createSchema={terminalCreateSchema}
      updateSchema={terminalUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
