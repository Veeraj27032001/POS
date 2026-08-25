"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { uomCreateSchema, uomUpdateSchema } from "@/lib/masters/schemas";

interface UomRow {
  id: string;
  name: string;
  abbreviation: string;
}

export default function UomsPage() {
  return (
    <ResourcePage<UomRow, z.infer<typeof uomCreateSchema>, z.infer<typeof uomUpdateSchema>>
      resource="uoms"
      title="Units of Measure"
      columns={[
        { key: "name", header: "Name" },
        { key: "abbreviation", header: "Abbreviation" },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "abbreviation", label: "Abbreviation", type: "text" },
      ]}
      createSchema={uomCreateSchema}
      updateSchema={uomUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
