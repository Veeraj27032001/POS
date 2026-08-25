"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { paymentMethodUpdateSchema } from "@/lib/masters/schemas";

interface PaymentMethodRow {
  id: string;
  name: string;
  type: string;
  requiresReference: boolean;
  isActive: boolean;
}

export default function PaymentMethodViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<PaymentMethodRow, z.infer<typeof paymentMethodUpdateSchema>>
      resource="payment-methods"
      title="Payment Methods"
      fields={[
        { name: "name", label: "Name", type: "text" },
        {
          name: "type",
          label: "Type",
          type: "select",
          options: [
            { value: "cash", label: "Cash" },
            { value: "card", label: "Card" },
            { value: "digital_wallet", label: "Digital wallet" },
            { value: "bank_transfer", label: "Bank transfer" },
            { value: "other", label: "Other" },
          ],
        },
        { name: "requiresReference", label: "Requires reference", type: "boolean" },
      ]}
      updateSchema={paymentMethodUpdateSchema}
      id={id}
    />
  );
}
