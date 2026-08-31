"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { customerCreateSchema, customerUpdateSchema } from "@/lib/masters/schemas";

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export default function CustomersPage() {
  return (
    <ResourcePage<
      CustomerRow,
      z.infer<typeof customerCreateSchema>,
      z.infer<typeof customerUpdateSchema>
    >
      resource="customers"
      title="Customers"
      columns={[
        { key: "name", header: "Name" },
        { key: "phone", header: "Phone" },
        { key: "email", header: "Email" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
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
        { name: "pincode", label: "Pincode", type: "text" },
        {
          name: "storeIds",
          label: "Stores",
          type: "multi-select",
          optionsResource: "stores/options",
          placeholder: "Select store(s)…",
        },
      ]}
      createSchema={customerCreateSchema}
      updateSchema={customerUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
