"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CancelHeldBillDialog } from "@/components/billing/cancel-held-bill-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/datetime/format";
import { useInvalidateResource } from "@/lib/pagination/useList";

interface HeldBillRow {
  id: string;
  documentNumber: string;
  billType: string;
  grandTotal: string;
  heldAt: string | null;
  customer: { name: string; phone: string } | null;
}

export default function HeldBillsPage() {
  const router = useRouter();
  const invalidate = useInvalidateResource();

  async function resume(id: string) {
    const res = await fetch(`/api/bills/${id}/resume`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to resume bill.");
      return;
    }
    router.push(`/billing?billId=${id}`);
  }

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Held Bills</h1>
        <Link href="/billing" className={buttonVariants({ variant: "outline" })}>
          Back to Billing
        </Link>
      </div>

      <DataTable<HeldBillRow>
        resource="bills"
        getRowId={(row) => row.id}
        filters={{ status: "held" }}
        emptyMessage="No bills are currently held."
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
            key: "heldAt",
            header: "Held at",
            render: (row) => (row.heldAt ? formatTimestamp(row.heldAt) : "—"),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => void resume(row.id)}>
                  Resume
                </Button>
                <CancelHeldBillDialog
                  billId={row.id}
                  documentNumber={row.documentNumber}
                  onCancelled={() => invalidate("bills")}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
