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
        { name: "gstin", label: "GSTIN", type: "text" },
        {
          name: "currencyId",
          label: "Currency",
          type: "select",
          optionsResource: "currencies",
          optionsLabelField: "code",
          placeholder: "Select currency…",
        },
        {
          name: "timezoneId",
          label: "Timezone",
          type: "select",
          optionsResource: "timezones",
          placeholder: "Select timezone…",
        },
        { name: "logoUrl", label: "Logo", type: "file" },
      ]}
      createSchema={storeCreateSchema}
      updateSchema={storeUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
