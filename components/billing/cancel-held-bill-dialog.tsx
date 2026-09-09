"use client";

import { useState } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useOptionsList } from "@/lib/masters/useOptionsList";

// Permanent, not resumable — releases whatever stock the hold had blocked
// and records a BillCancellation. Distinct from Discard, which only ever
// applies to an empty draft with nothing to release.
export function CancelHeldBillDialog({
  billId,
  documentNumber,
  onCancelled,
}: {
  billId: string;
  documentNumber: string;
  onCancelled: () => void;
}) {
  const reasons = useOptionsList("reason-codes/options", "label", "category=void");
  const [open, setOpen] = useState(false);
  const [reasonCodeId, setReasonCodeId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function submit() {
    if (!reasonCodeId) {
      toast.error("Select a reason.");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/bills/${billId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCodeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to cancel bill.");
        return;
      }
      toast.success("Bill cancelled.");
      setOpen(false);
      setReasonCodeId(null);
      onCancelled();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive" data-kbd-item="" />}>
        Cancel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel bill {documentNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <SearchableSelect
            options={reasons}
            value={reasonCodeId}
            onChange={setReasonCodeId}
            placeholder="Select reason…"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void submit()}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling…" : "Cancel bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
