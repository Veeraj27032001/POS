"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/datetime/format";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface DraftBillRow {
  id: string;
  documentNumber: string;
  billType: string;
  grandTotal: string;
  createdAt: string;
  customer: { name: string; phone: string } | null;
}

export default function DraftBillsPage() {
  const router = useRouter();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Draft Bills</h1>
        <Link href="/billing" data-kbd-item="" className={buttonVariants({ variant: "outline" })}>
          Back to Billing
        </Link>
      </div>

      <DataTable<DraftBillRow>
        resource="bills"
        getRowId={(row) => row.id}
        filters={{ status: "draft" }}
        emptyMessage="No draft bills saved."
        columns={[
          { key: "documentNumber", header: "Bill No." },
          {
            key: "customer",
            header: "Customer",
            render: (row) => (row.customer ? row.customer.name : "Walk-in"),
          },
          {
            key: "grandTotal",
            header: "Grand total",
            render: (row) => `₹${Number(row.grandTotal).toFixed(2)}`,
          },
          {
            key: "createdAt",
            header: "Saved at",
            render: (row) => (row.createdAt ? formatTimestamp(row.createdAt) : "—"),
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Button
                size="sm"
                data-kbd-item=""
                onClick={() => router.push(`/billing?billId=${row.id}`)}
              >
                Continue
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
