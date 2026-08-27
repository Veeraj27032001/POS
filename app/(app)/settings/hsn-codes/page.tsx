"use client";

import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { hsnCodeCreateSchema, hsnCodeUpdateSchema } from "@/lib/masters/schemas";

import { ImportHsnCodesDialog } from "./import-hsn-codes-dialog";

interface HsnCodeRow {
  id: string;
  hsnCode: string;
  description: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  isActive: boolean;
}

export default function HsnCodesPage() {
  return (
    <ResourcePage<
      HsnCodeRow,
      z.infer<typeof hsnCodeCreateSchema>,
      z.infer<typeof hsnCodeUpdateSchema>
    >
      resource="hsn-codes"
      title="HSN Codes"
      searchable
      headerExtra={<ImportHsnCodesDialog />}
      columns={[
        { key: "hsnCode", header: "HSN code" },
        { key: "description", header: "Description" },
        { key: "cgstRate", header: "CGST %" },
        { key: "sgstRate", header: "SGST %" },
        { key: "igstRate", header: "IGST %" },
        { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
      ]}
      fields={[
        { name: "hsnCode", label: "HSN code", type: "text" },
        { name: "description", label: "Description", type: "text" },
        { name: "cgstRate", label: "CGST %", type: "number" },
        { name: "sgstRate", label: "SGST %", type: "number" },
        { name: "igstRate", label: "IGST %", type: "number" },
      ]}
      createSchema={hsnCodeCreateSchema}
      updateSchema={hsnCodeUpdateSchema}
      getRowId={(row) => row.id}
    />
  );
}
