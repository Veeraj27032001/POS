"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { warehouseCreateSchema, warehouseUpdateSchema } from "@/lib/masters/schemas";

interface WarehouseRow {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

export default function WarehousesPage() {
  return (
    <ResourcePage<
      WarehouseRow,
      z.infer<typeof warehouseCreateSchema>,
      z.infer<typeof warehouseUpdateSchema>
    >
      resource="warehouses"
      title="Warehouses"
      columns={[
        { key: "name", header: "Name" },
        { key: "address", header: "Address" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
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
      createSchema={warehouseCreateSchema}
      updateSchema={warehouseUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
