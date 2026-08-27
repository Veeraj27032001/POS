"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { customerUpdateSchema } from "@/lib/masters/schemas";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
}

export default function CustomerViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<CustomerRow, z.infer<typeof customerUpdateSchema>>
      resource="customers"
      title="Customers"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "email", label: "Email", type: "text" },
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
          name: "storeIds",
          label: "Stores",
          type: "multi-select",
          optionsResource: "stores/options",
          placeholder: "Select store(s)…",
        },
      ]}
      updateSchema={customerUpdateSchema}
      id={id}
    />
  );
}
