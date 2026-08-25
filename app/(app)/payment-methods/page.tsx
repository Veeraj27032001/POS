"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { paymentMethodCreateSchema, paymentMethodUpdateSchema } from "@/lib/masters/schemas";

interface PaymentMethodRow {
  id: string;
  name: string;
  type: string;
  requiresReference: boolean;
  isActive: boolean;
}

export default function PaymentMethodsPage() {
  return (
    <ResourcePage<
      PaymentMethodRow,
      z.infer<typeof paymentMethodCreateSchema>,
      z.infer<typeof paymentMethodUpdateSchema>
    >
      resource="payment-methods"
      title="Payment Methods"
      searchable={false}
      columns={[
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        {
          key: "requiresReference",
          header: "Needs reference",
          render: (row) => (row.requiresReference ? "Yes" : "No"),
        },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        {
          name: "type",
          label: "Type",
          type: "select",
          options: [
            { value: "cash", label: "Cash" },
            { value: "card", label: "Card" },
            { value: "digital_wallet", label: "Digital wallet" },
            { value: "bank_transfer", label: "Bank transfer" },
            { value: "other", label: "Other" },
          ],
        },
        { name: "requiresReference", label: "Requires reference", type: "boolean" },
      ]}
      createSchema={paymentMethodCreateSchema}
      updateSchema={paymentMethodUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
