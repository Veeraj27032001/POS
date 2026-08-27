"use client";

import { useState } from "react";
import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { StoreCardFilter } from "@/components/store-card-filter";
import { cashDenominationCreateSchema, cashDenominationUpdateSchema } from "@/lib/masters/schemas";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface CashDenominationRow {
  id: string;
  value: string;
  type: string;
  currencyId: string;
  isActive: boolean;
}

export default function CashDenominationsPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const currencies = useOptionsList("currencies", "code");

  return (
    <div>
      <div className="px-8 pt-8">
        <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {selectedStoreId && (
        <ResourcePage<
          CashDenominationRow,
          z.infer<typeof cashDenominationCreateSchema>,
          z.infer<typeof cashDenominationUpdateSchema>
        >
          resource="cash-denominations"
          title="Cash Denominations"
          searchable={false}
          columns={[
            { key: "value", header: "Value" },
            { key: "type", header: "Type" },
            {
              key: "currencyId",
              header: "Currency",
              render: (row) =>
                currencies.find((c) => c.value === row.currencyId)?.label ?? row.currencyId,
            },
            { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
          ]}
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
          createSchema={cashDenominationCreateSchema}
          updateSchema={cashDenominationUpdateSchema}
          getRowId={(row) => row.id}
          filters={{ storeId: selectedStoreId }}
          createDefaultValues={{ storeId: selectedStoreId }}
        />
      )}
    </div>
  );
}
