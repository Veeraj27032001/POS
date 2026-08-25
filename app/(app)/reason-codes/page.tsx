"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { reasonCodeCreateSchema, reasonCodeUpdateSchema } from "@/lib/masters/schemas";

interface ReasonCodeRow {
  id: string;
  category: string;
  label: string;
  isActive: boolean;
}

export default function ReasonCodesPage() {
  return (
    <ResourcePage<
      ReasonCodeRow,
      z.infer<typeof reasonCodeCreateSchema>,
      z.infer<typeof reasonCodeUpdateSchema>
    >
      resource="reason-codes"
      title="Reason Codes"
      columns={[
        { key: "category", header: "Category" },
        { key: "label", header: "Label" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            { value: "return", label: "Return" },
            { value: "void", label: "Void" },
            { value: "discount", label: "Discount" },
            { value: "stock_adjustment", label: "Stock adjustment" },
            { value: "damage", label: "Damage" },
            { value: "stock_block", label: "Stock block" },
          ],
        },
        { name: "label", label: "Label", type: "text" },
      ]}
      createSchema={reasonCodeCreateSchema}
      updateSchema={reasonCodeUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
