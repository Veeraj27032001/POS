"use client";

import { useState } from "react";
import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { StoreCardFilter } from "@/components/store-card-filter";
import { warehouseCreateSchema, warehouseUpdateSchema } from "@/lib/masters/schemas";

interface WarehouseRow {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

export default function WarehousesPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  return (
    <div>
      <div className="px-8 pt-8">
        <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {selectedStoreId && (
        <ResourcePage<
          WarehouseRow,
          z.infer<typeof warehouseCreateSchema>,
          z.infer<typeof warehouseUpdateSchema>
        >
          resource="warehouses"
          title="Storage"
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
          filters={{ storeId: selectedStoreId }}
          createDefaultValues={{ storeId: selectedStoreId }}
        />
      )}
    </div>
  );
}
