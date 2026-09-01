"use client";

import { useState } from "react";
import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { StoreCardFilter } from "@/components/store-card-filter";
import { billFormatCreateSchema, billFormatUpdateSchema } from "@/lib/masters/schemas";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";

interface BillFormatRow {
  id: string;
  name: string;
  effectiveFrom: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function BillFormatsPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  return (
    <div>
      <div className="px-8 pt-8">
        <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {selectedStoreId && (
        <ResourcePage<
          BillFormatRow,
          z.infer<typeof billFormatCreateSchema>,
          z.infer<typeof billFormatUpdateSchema>
        >
          resource="bill-formats"
          title="Bill Formats"
          searchable
          columns={[
            { key: "name", header: "Name" },
            {
              key: "effectiveFrom",
              header: "Effective from",
              render: (row) => formatDateOnly(toDateOnly(row.effectiveFrom)),
            },
            {
              key: "isDefault",
              header: "Default",
              render: (row) => (row.isDefault ? "Yes" : "No"),
            },
            { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
          ]}
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "effectiveFrom", label: "Effective from", type: "date" },
            {
              name: "templateHtml",
              label: "Template HTML",
              type: "textarea",
              placeholder:
                "<html>…{{documentNumber}}, {{grandTotal}}, {{#each lines}}{{productName}}{{/each}}…</html>",
            },
            { name: "isDefault", label: "Default for this store", type: "boolean" },
          ]}
          createSchema={billFormatCreateSchema}
          updateSchema={billFormatUpdateSchema}
          getRowId={(row) => row.id}
          filters={{ storeId: selectedStoreId }}
          createDefaultValues={{ storeId: selectedStoreId }}
        />
      )}
    </div>
  );
}
