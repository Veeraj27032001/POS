"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { cashDenominationUpdateSchema } from "@/lib/masters/schemas";

interface CashDenominationRow {
  id: string;
  value: string;
  type: string;
  currency: string;
  isActive: boolean;
}

export default function CashDenominationViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<CashDenominationRow, z.infer<typeof cashDenominationUpdateSchema>>
      resource="cash-denominations"
      title="Cash Denominations"
      fields={[
        { name: "value", label: "Value", type: "number" },
        {
          name: "type",
          label: "Type",
          type: "select",
          options: [
            { value: "note", label: "Note" },
            { value: "coin", label: "Coin" },
          ],
        },
        { name: "currency", label: "Currency", type: "text" },
      ]}
      updateSchema={cashDenominationUpdateSchema}
      id={id}
    />
  );
}
