"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { formatTimestamp } from "@/lib/datetime/format";
import { printCreditNote } from "@/lib/billing/printing";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";

interface CreditNoteDetail {
  id: string;
  documentNumber: string;
  amount: string;
  sourceType: string;
  createdAt: string;
  originalBill: { id: string; documentNumber: string; billType: string };
  customer: { name: string; phone: string };
  billReturn: { id: string; documentNumber: string } | null;
  billCancellation: { id: string; documentNumber: string } | null;
  createdByUser: { name: string };
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<CreditNoteDetail | null | undefined>(undefined);
  const [printing, setPrinting] = useState(false);
  const currencySymbol = useStoreCurrencySymbol();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    fetch(`/api/credit-notes/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setDetail(body));
  }, [id]);

  async function handlePrint() {
    if (!detail) return;
    setPrinting(true);
    try {
      await printCreditNote(detail.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print the credit note.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      {detail === undefined && <LoadingState />}
      {detail === null && <p className="text-muted-foreground">Credit note not found.</p>}

      {detail && (
        <>
          <Link
            href="/credit-notes"
            data-kbd-item=""
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Back to Credit Notes
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
                <Link
                  key="bill"
                  href={`/bills/${detail.originalBill.id}`}
                  data-kbd-item=""
                  className="hover:underline"
                >
                  {detail.originalBill.documentNumber} (
                  {BILL_TYPE_LABELS[detail.originalBill.billType]})
                </Link>,
              ],
              ["Customer", `${detail.customer.name} — ${detail.customer.phone}`],
              ["Amount", `${currencySymbol}${Number(detail.amount).toFixed(2)}`],
              [
                "Source",
                detail.billReturn ? (
                  <Link
                    key="return"
                    href={`/bill-returns/${detail.billReturn.id}`}
                    data-kbd-item=""
                    className="hover:underline"
                  >
                    Return {detail.billReturn.documentNumber}
                  </Link>
                ) : detail.billCancellation ? (
                  `Cancellation ${detail.billCancellation.documentNumber}`
                ) : (
                  "—"
                ),
              ],
              ["Created by", detail.createdByUser.name],
              ["Created", formatTimestamp(detail.createdAt)],
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
