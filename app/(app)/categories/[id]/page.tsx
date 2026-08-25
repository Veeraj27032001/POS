"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { categoryUpdateSchema } from "@/lib/masters/schemas";

interface CategoryRow {
  id: string;
  name: string;
  isActive: boolean;
}

export default function CategoryViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<CategoryRow, z.infer<typeof categoryUpdateSchema>>
      resource="categories"
      title="Categories"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "isActive", label: "Active", type: "boolean" },
      ]}
      updateSchema={categoryUpdateSchema}
      id={id}
    />
  );
}
