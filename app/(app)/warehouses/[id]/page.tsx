"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { warehouseUpdateSchema } from "@/lib/masters/schemas";

interface WarehouseRow {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

export default function WarehouseViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<WarehouseRow, z.infer<typeof warehouseUpdateSchema>>
      resource="warehouses"
      title="Warehouses"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "address", label: "Address", type: "text" },
      ]}
      updateSchema={warehouseUpdateSchema}
      id={id}
    />
  );
}
