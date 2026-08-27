"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { supplierUpdateSchema } from "@/lib/masters/schemas";

interface SupplierRow {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
}

export default function SupplierViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<SupplierRow, z.infer<typeof supplierUpdateSchema>>
      resource="suppliers"
      title="Suppliers"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "contactPhone", label: "Contact phone", type: "text" },
        { name: "contactEmail", label: "Contact email", type: "text" },
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
        { name: "paymentTerms", label: "Payment terms", type: "text" },
        {
          name: "storeIds",
          label: "Stores",
          type: "multi-select",
          optionsResource: "stores/options",
          placeholder: "Select store(s)…",
        },
      ]}
      updateSchema={supplierUpdateSchema}
      id={id}
    />
  );
}
