"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { storeUpdateSchema } from "@/lib/masters/schemas";

interface StoreRow {
  id: string;
  name: string;
  code: string;
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
        { name: "code", label: "Store code", type: "text" },
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
      updateSchema={storeUpdateSchema}
      id={id}
    />
  );
}
