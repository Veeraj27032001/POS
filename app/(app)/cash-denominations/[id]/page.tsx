"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { cashDenominationUpdateSchema } from "@/lib/masters/schemas";

interface CashDenominationRow {
  id: string;
  value: string;
  type: string;
  storeId: string;
  currencyId: string;
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
          placeholder: "Select type…",
          options: [
            { value: "note", label: "Note" },
            { value: "coin", label: "Coin" },
          ],
        },
        {
          name: "storeId",
          label: "Store",
          type: "select",
          optionsResource: "stores/options",
          placeholder: "Select store…",
        },
        {
          name: "currencyId",
          label: "Currency",
          type: "select",
          optionsResource: "currencies",
          optionsLabelField: "code",
          placeholder: "Select currency…",
        },
      ]}
      updateSchema={cashDenominationUpdateSchema}
      id={id}
    />
  );
}
