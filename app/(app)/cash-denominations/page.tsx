"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { cashDenominationCreateSchema, cashDenominationUpdateSchema } from "@/lib/masters/schemas";

interface CashDenominationRow {
  id: string;
  value: string;
  type: string;
  currency: string;
  isActive: boolean;
}

export default function CashDenominationsPage() {
  return (
    <ResourcePage<
      CashDenominationRow,
      z.infer<typeof cashDenominationCreateSchema>,
      z.infer<typeof cashDenominationUpdateSchema>
    >
      resource="cash-denominations"
      title="Cash Denominations"
      searchable={false}
      columns={[
        { key: "value", header: "Value" },
        { key: "type", header: "Type" },
        { key: "currency", header: "Currency" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "value", label: "Value", type: "number" },
        {
          name: "type",
          label: "Type",
          type: "select",
          options: [
            { value: "note", label: "Note" },
            { value: "coin", label: "Coin" },
          ],
        },
        { name: "currency", label: "Currency", type: "text", placeholder: "INR" },
      ]}
      createSchema={cashDenominationCreateSchema}
      updateSchema={cashDenominationUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
