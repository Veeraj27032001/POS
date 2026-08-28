"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { financialYearCreateSchema, financialYearUpdateSchema } from "@/lib/masters/schemas";

interface FinancialYearRow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function FinancialYearsPage() {
  return (
    <ResourcePage<
      FinancialYearRow,
      z.infer<typeof financialYearCreateSchema>,
      z.infer<typeof financialYearUpdateSchema>
    >
      resource="financial-years-admin"
      title="Financial Years"
      searchable
      columns={[
        { key: "label", header: "Label" },
        {
          key: "startDate",
          header: "Start date",
          render: (row) => formatDateOnly(toDateOnly(row.startDate)),
        },
        {
          key: "endDate",
          header: "End date",
          render: (row) => formatDateOnly(toDateOnly(row.endDate)),
        },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "label", label: "Label", type: "text" },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "endDate", label: "End date", type: "date" },
      ]}
      createSchema={financialYearCreateSchema}
      updateSchema={financialYearUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
