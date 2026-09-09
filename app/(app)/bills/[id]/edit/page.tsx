"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  CustomerDetailsFields,
  emptyCustomerDraft,
  type CustomerDraft,
} from "@/components/billing/customer-details-fields";
import { EditableLineValue } from "@/components/billing/editable-line-value";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { isCompletedBillStillEditable } from "@/lib/billing/editableCompletedBillWindow";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { useProductSearch } from "@/lib/masters/useProductSearch";

interface BillLineRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  status: string;
  allocations: { warehouseId: string; warehouse: { name: string } }[];
}

interface BillDetail {
  id: string;
  documentNumber: string;
  status: string;
  billDate: string;
  storeId: string;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
  completedAt: string | null;
  lines: BillLineRow[];
  outstandingBalance: number;
}

function money(value: number): string {
  return value.toFixed(2);
}

export default function BillEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<BillDetail | null | undefined>(undefined);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [billDate, setBillDate] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(emptyCustomerDraft);
  const [savingHeader, setSavingHeader] = useState(false);
  const [warehouseTargets, setWarehouseTargets] = useState<Record<string, string | null>>({});
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newProductQty, setNewProductQty] = useState("1");
  const [addingLine, setAddingLine] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const currencySymbol = useStoreCurrencySymbol();
  const customers = useOptionsList("customers", "name");
  const warehouses = useOptionsList("warehouses", "name");
  const productSearch = useProductSearch();
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  function load() {
    fetch(`/api/bills/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: BillDetail | null) => {
        setBill(body);
        if (body) {
          setBillDate(body.billDate.slice(0, 10));
          setSelectedCustomerId(body.customer?.id ?? null);
        }
      });
  }

  useEffect(load, [id]);

  const editable =
    bill != null && bill.status === "completed" && isCompletedBillStillEditable(bill.completedAt);

  async function saveHeader() {
    setSavingHeader(true);
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billDate, customerId: selectedCustomerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update bill details.");
        return;
      }
      toast.success("Bill details updated.");
      load();
    } finally {
      setSavingHeader(false);
    }
  }

  async function updateLineQuantity(lineId: string, quantity: number) {
    setBusyLineId(lineId);
    try {
      const res = await fetch(`/api/bills/${id}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update the line.");
        return;
      }
      const body = (await res.json()) as { warning?: string };
      if (body.warning) toast.warning(body.warning);
      toast.success("Quantity updated.");
      load();
    } finally {
      setBusyLineId(null);
    }
  }

  async function changeWarehouse(line: BillLineRow) {
    const warehouseId = warehouseTargets[line.id];
    if (!warehouseId) return;
    setBusyLineId(line.id);
    try {
      const res = await fetch(`/api/bills/${id}/lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: line.quantity,
          allocations: [{ warehouseId, quantity: line.quantity }],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to change the warehouse.");
        return;
      }
      toast.success("Warehouse updated.");
      setWarehouseTargets((prev) => ({ ...prev, [line.id]: null }));
      load();
    } finally {
      setBusyLineId(null);
    }
  }

  async function removeLine(lineId: string) {
    if (!window.confirm("Remove this line from the bill?")) return;
    setBusyLineId(lineId);
    try {
      const res = await fetch(`/api/bills/${id}/lines/${lineId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to remove the line.");
        return;
      }
      toast.success("Line removed.");
      load();
    } finally {
      setBusyLineId(null);
    }
  }

  async function addLine() {
    if (!newProductId) return;
    const quantity = Number(newProductQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    setAddingLine(true);
    try {
      const res = await fetch(`/api/bills/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: newProductId, quantity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to add the product.");
        return;
      }
      const body = (await res.json()) as { warning?: string };
      if (body.warning) toast.warning(body.warning);
      toast.success("Product added.");
      setNewProductId(null);
      setNewProductQty("1");
      load();
    } finally {
      setAddingLine(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      const res = await fetch(`/api/bills/${id}`);
      const body = (await res.json().catch(() => null)) as BillDetail | null;
      if (body && body.outstandingBalance > 0) {
        router.push(`/billing/${id}/collect`);
        return;
      }
      router.push(`/bills/${id}`);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <Link
        href={`/bills/${id}`}
        data-kbd-item=""
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Back to {bill?.documentNumber ?? "bill"}
      </Link>

      {bill === undefined && <p className="text-muted-foreground">Loading…</p>}
      {bill === null && <p className="text-muted-foreground">Bill not found.</p>}

      {bill && !editable && (
        <p className="text-warning text-sm">
          This bill can no longer be edited directly — use Return instead.
        </p>
      )}

      {bill && editable && (
        <>
          <h1 className="text-2xl font-semibold">Edit {bill.documentNumber}</h1>

          <div className="bg-card space-y-3 rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bill date</Label>
                <Input
                  type="date"
                  data-kbd-item=""
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Existing customer</Label>
                <SearchableSelect
                  data-kbd-item=""
                  options={customers}
                  value={selectedCustomerId}
                  onChange={setSelectedCustomerId}
                  placeholder="Select customer…"
                />
              </div>
            </div>
            <CustomerDetailsFields
              selectedCustomerId={selectedCustomerId}
              draft={customerDraft}
              customers={customers}
              onSelectExisting={setSelectedCustomerId}
              onChange={setCustomerDraft}
            />
            <Button
              type="button"
              data-kbd-item=""
              onClick={() => void saveHeader()}
              disabled={savingHeader}
            >
              {savingHeader ? "Saving…" : "Save bill details"}
            </Button>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.lines
                  .filter((line) => line.status === "active")
                  .map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>{line.productName}</div>
                        <div className="text-muted-foreground text-xs">{line.productBarcode}</div>
                      </TableCell>
                      <TableCell>
                        <EditableLineValue
                          value={line.quantity}
                          min={1}
                          onCommit={(next) => void updateLineQuantity(line.id, next)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">
                            {line.allocations.map((a) => a.warehouse.name).join(", ") || "—"}
                          </span>
                          <SearchableSelect
                            data-kbd-item=""
                            options={warehouses}
                            value={warehouseTargets[line.id] ?? null}
                            onChange={(v) =>
                              setWarehouseTargets((prev) => ({ ...prev, [line.id]: v }))
                            }
                            placeholder="Change…"
                            className="w-40"
                          />
                          {warehouseTargets[line.id] && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-kbd-item=""
                              disabled={busyLineId === line.id}
                              onClick={() => void changeWarehouse(line)}
                            >
                              Move
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          data-kbd-item=""
                          disabled={busyLineId === line.id}
                          onClick={() => void removeLine(line.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-end gap-2 border-t p-3">
              <div className="min-w-64 space-y-1.5">
                <Label>Add a product</Label>
                <SearchableSelect
                  data-kbd-item=""
                  onSearch={productSearch.onSearch}
                  value={newProductId}
                  onChange={setNewProductId}
                  placeholder="Search product…"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  data-kbd-item=""
                  value={newProductQty}
                  onChange={(e) => setNewProductQty(e.target.value)}
                />
              </div>
              <Button
                type="button"
                data-kbd-item=""
                disabled={!newProductId || addingLine}
                onClick={() => void addLine()}
              >
                {addingLine ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>

          {bill.outstandingBalance > 0 && (
            <p className="text-warning text-sm">
              {currencySymbol}
              {money(bill.outstandingBalance)} still owed after these changes.
            </p>
          )}

          <Button type="button" data-kbd-item="" disabled={finishing} onClick={() => void finish()}>
            {finishing ? "Finishing…" : "Done"}
          </Button>
        </>
      )}
    </div>
  );
}
