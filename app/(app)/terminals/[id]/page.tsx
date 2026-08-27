"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { terminalUpdateSchema } from "@/lib/masters/schemas";

interface TerminalRow {
  id: string;
  name: string;
  deviceIdentifier: string | null;
  isActive: boolean;
}

export default function TerminalViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<TerminalRow, z.infer<typeof terminalUpdateSchema>>
      resource="terminals"
      title="Terminals"
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
      updateSchema={terminalUpdateSchema}
      id={id}
    />
  );
}
