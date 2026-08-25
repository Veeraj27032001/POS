"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { storeUpdateSchema } from "@/lib/masters/schemas";

interface StoreRow {
  id: string;
  name: string;
  address: string;
  gstin: string | null;
  isActive: boolean;
}

export default function StoreViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<StoreRow, z.infer<typeof storeUpdateSchema>>
      resource="stores"
      title="Stores"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "address", label: "Address", type: "text" },
        { name: "gstin", label: "GSTIN", type: "text" },
        { name: "timezone", label: "Timezone", type: "text" },
        { name: "defaultCurrency", label: "Currency", type: "text" },
        { name: "logoUrl", label: "Logo", type: "file" },
      ]}
      updateSchema={storeUpdateSchema}
      id={id}
    />
  );
}
