"use client";

import { useParams } from "next/navigation";
import type { z } from "zod";

import { ResourceViewPage } from "@/components/resource-form/resource-view-page";
import { reasonCodeUpdateSchema } from "@/lib/masters/schemas";

interface ReasonCodeRow {
  id: string;
  category: string;
  label: string;
  isActive: boolean;
}

export default function ReasonCodeViewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ResourceViewPage<ReasonCodeRow, z.infer<typeof reasonCodeUpdateSchema>>
      resource="reason-codes"
      title="Reason Codes"
      fields={[
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            { value: "return", label: "Return" },
            { value: "void", label: "Void" },
            { value: "discount", label: "Discount" },
            { value: "stock_adjustment", label: "Stock adjustment" },
            { value: "damage", label: "Damage" },
            { value: "stock_block", label: "Stock block" },
          ],
        },
        { name: "label", label: "Label", type: "text" },
      ]}
      updateSchema={reasonCodeUpdateSchema}
      id={id}
    />
  );
}
