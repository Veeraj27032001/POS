"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { storeCreateSchema, storeUpdateSchema } from "@/lib/masters/schemas";

interface StoreRow {
  id: string;
  name: string;
  address: string;
  gstin: string | null;
  isActive: boolean;
}

export default function StoresPage() {
  return (
    <ResourcePage<StoreRow, z.infer<typeof storeCreateSchema>, z.infer<typeof storeUpdateSchema>>
      resource="stores"
      title="Stores"
      columns={[
        { key: "name", header: "Name" },
        { key: "address", header: "Address" },
        { key: "gstin", header: "GSTIN", render: (row) => row.gstin ?? "—" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "address", label: "Address", type: "text" },
        { name: "gstin", label: "GSTIN", type: "text" },
        { name: "timezone", label: "Timezone", type: "text", placeholder: "Asia/Kolkata" },
        { name: "defaultCurrency", label: "Currency", type: "text", placeholder: "INR" },
        { name: "logoUrl", label: "Logo", type: "file" },
      ]}
      createSchema={storeCreateSchema}
      updateSchema={storeUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
