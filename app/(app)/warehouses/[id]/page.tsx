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
      title="Storage"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "address", label: "Address", type: "text" },
        {
          name: "countryId",
          label: "Country",
          type: "select",
          optionsResource: "countries",
          placeholder: "Select country…",
        },
        {
          name: "stateId",
          label: "State",
          type: "select",
          optionsResource: "states",
          dependsOn: "countryId",
          placeholder: "Select state…",
        },
        {
          name: "storeId",
          label: "Store",
          type: "select",
          optionsResource: "stores/options",
          placeholder: "Select store…",
        },
      ]}
      updateSchema={warehouseUpdateSchema}
      id={id}
    />
  );
}
