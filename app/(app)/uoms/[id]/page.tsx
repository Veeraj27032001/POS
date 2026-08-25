"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { uomUpdateSchema } from "@/lib/masters/schemas";

interface UomRow {
  id: string;
  name: string;
  abbreviation: string;
}

export default function UomViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<UomRow, z.infer<typeof uomUpdateSchema>>
      resource="uoms"
      title="Units of Measure"
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "abbreviation", label: "Abbreviation", type: "text" },
      ]}
      updateSchema={uomUpdateSchema}
      id={id}
    />
  );
}
