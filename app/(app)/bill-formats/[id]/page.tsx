"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { BillFormatPreview } from "@/components/billing/bill-format-preview";
import { billFormatCreateSchema, billFormatUpdateSchema } from "@/lib/masters/schemas";

interface BillFormatRow {
  id: string;
  storeId: string;
  billType: string;
  formatKind: string;
  name: string;
  effectiveFrom: string;
  templateHtml: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function BillFormatViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<BillFormatRow, z.infer<typeof billFormatUpdateSchema>>
      headerActions={(row) => (
        <Link
          href={`/bill-formats/${row.id}/design`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Design
        </Link>
      )}
      resource="bill-formats"
      title="Bill Formats"
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
        },
        { name: "isDefault", label: "Default for this store", type: "boolean" },
      ]}
      createSchema={billFormatCreateSchema}
      updateSchema={billFormatUpdateSchema}
      id={id}
      renderFormExtra={(control) => <BillFormatPreview control={control} />}
      dialogClassName="sm:max-w-2xl"
    />
  );
}
