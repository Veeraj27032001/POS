"use client";

import Link from "next/link";
import { useState } from "react";
import type { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { ResourcePage } from "@/components/resource-form/resource-page";
import { StoreCardFilter } from "@/components/store-card-filter";
import { BillFormatPreview } from "@/components/billing/bill-format-preview";
import { billFormatCreateSchema, billFormatUpdateSchema } from "@/lib/masters/schemas";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { DEFAULT_BILL_TEMPLATE_HTML } from "@/lib/billing/defaultBillFormatTemplates";

interface BillFormatRow {
  id: string;
  billType: string;
  formatKind: string;
  name: string;
  effectiveFrom: string;
  isDefault: boolean;
  isActive: boolean;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

const FORMAT_KIND_LABELS: Record<string, string> = {
  receipt: "Receipt",
  bill: "Bill",
  credit_note: "Credit Note",
  refund: "Refund",
};

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
            {
              key: "formatKind",
              header: "Type",
              render: (row) => FORMAT_KIND_LABELS[row.formatKind] ?? row.formatKind,
            },
            {
              key: "billType",
              header: "Bill type",
              render: (row) => BILL_TYPE_LABELS[row.billType] ?? row.billType,
            },
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
            {
              name: "formatKind",
              label: "Type",
              type: "select",
              placeholder: "Select format type…",
              options: [
                { value: "receipt", label: "Receipt (small, printed at counter)" },
                { value: "bill", label: "Bill (full tax invoice)" },
                { value: "credit_note", label: "Credit Note" },
                { value: "refund", label: "Refund" },
              ],
            },
            {
              name: "billType",
              label: "Bill type",
              type: "select",
              placeholder: "Select bill type…",
              options: [
                { value: "cash_bill", label: "Cash Bill" },
                { value: "credit_bill", label: "Credit Bill" },
                { value: "online_bill", label: "Online Bill" },
              ],
            },
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
          createDefaultValues={{
            storeId: selectedStoreId,
            templateHtml: DEFAULT_BILL_TEMPLATE_HTML,
          }}
          renderFormExtra={(control) => <BillFormatPreview control={control} />}
          dialogClassName="sm:max-w-2xl"
          rowActions={(row) => (
            <Link
              href={`/bill-formats/${row.id}/design`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Design
            </Link>
          )}
        />
      )}
    </div>
  );
}
