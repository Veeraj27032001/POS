"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { categoryCreateSchema, categoryUpdateSchema } from "@/lib/masters/schemas";

interface CategoryRow {
  id: string;
  name: string;
  isActive: boolean;
}

export default function CategoriesPage() {
  return (
    <ResourcePage<
      CategoryRow,
      z.infer<typeof categoryCreateSchema>,
      z.infer<typeof categoryUpdateSchema>
    >
      resource="categories"
      title="Categories"
      columns={[
        { key: "name", header: "Name" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "isActive", label: "Active", type: "boolean" },
      ]}
      createSchema={categoryCreateSchema}
      updateSchema={categoryUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
