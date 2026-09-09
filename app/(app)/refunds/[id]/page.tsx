"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";
import { printRefund } from "@/lib/billing/printing";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface RefundDetail {
  id: string;
  documentNumber: string;
  amount: string;
  status: string;
  sourceType: string;
  createdAt: string;
  completedAt: string | null;
  refundMethod: { name: string } | null;
  processedByUser: { name: string };
  source: {
    id: string;
    documentNumber: string;
    bill: { id: string; documentNumber: string };
  } | null;
}

export default function RefundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<RefundDetail | null | undefined>(undefined);
  const [printing, setPrinting] = useState(false);
  const currencySymbol = useStoreCurrencySymbol();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/refunds/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setDetail(body));
  }, [id]);

  async function handlePrint() {
    if (!detail) return;
    setPrinting(true);
    try {
      await printRefund(detail.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the refund.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      {detail === undefined && <p className="text-muted-foreground">Loading…</p>}
      {detail === null && <p className="text-muted-foreground">Refund not found.</p>}

      {detail && (
        <>
          <Link
            href="/refunds"
            data-kbd-item=""
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Back to Refunds
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">{detail.documentNumber}</h1>
            <Button
              variant="outline"
              size="sm"
              data-kbd-item=""
              onClick={handlePrint}
              disabled={printing}
            >
              {printing ? "Printing…" : "Print"}
            </Button>
          </div>

          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "Bill",
                detail.source ? (
                  <Link
                    key="bill"
                    href={`/bills/${detail.source.bill.id}`}
                    data-kbd-item=""
                    className="hover:underline"
                  >
                    {detail.source.bill.documentNumber}
                  </Link>
                ) : (
                  "—"
                ),
              ],
              [
                "Source",
                detail.source ? (
                  <Link
                    key="source"
                    href={
                      detail.sourceType === "bill_return"
                        ? `/bill-returns/${detail.source.id}`
                        : `/bills/${detail.source.bill.id}`
                    }
                    data-kbd-item=""
                    className="hover:underline"
                  >
                    {detail.sourceType === "bill_return" ? "Return" : "Cancellation"}{" "}
                    {detail.source.documentNumber}
                  </Link>
                ) : (
                  "—"
                ),
              ],
              ["Method", detail.refundMethod?.name ?? "—"],
              ["Status", detail.status],
              ["Amount", `${currencySymbol}${Number(detail.amount).toFixed(2)}`],
              ["Processed by", detail.processedByUser.name],
              ["Created", formatTimestamp(detail.createdAt)],
              ["Completed", detail.completedAt ? formatTimestamp(detail.completedAt) : "—"],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-card flex flex-col gap-1 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
