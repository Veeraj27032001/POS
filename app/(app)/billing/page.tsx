"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EditableLineValue } from "@/components/billing/editable-line-value";
import { LineWarehouseSplit } from "@/components/billing/line-warehouse-split";
import { NewCustomerInlineForm } from "@/components/billing/new-customer-inline-form";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { asAppSession } from "@/lib/auth/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSelectedTerminal } from "@/lib/billing/useSelectedTerminal";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface BillLineAllocation {
  warehouseId: string;
  quantity: number;
  warehouse: { id: string; name: string };
}

interface BillLineRow {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  unitPrice: string;
  discountApplied: string | null;
  lineTotal: string;
  taxBreakdown: { taxAmount: number } | null;
  status: string;
  allocations: BillLineAllocation[];
}

interface BillPaymentRow {
  id: string;
  amount: string;
  status: string;
  paymentMethod: { name: string; type: string };
}

interface BillDetail {
  id: string;
  documentNumber: string;
  billType: string;
  status: string;
  customer: { id: string; name: string; phone: string | null } | null;
  subtotal: string;
  discountTotal: string;
  overallDiscount: string;
  taxTotal: string;
  grandTotal: string;
  lines: BillLineRow[];
  payments: BillPaymentRow[];
}

interface ProductMatch {
  id: string;
  name: string;
  systemBarcode: string;
  skuBarcode: string | null;
  price: string;
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

export default function BillingPage() {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const searchParams = useSearchParams();

  const terminals = useOptionsList("terminals", "name");
  const customers = useOptionsList("customers", "name");
  const paymentMethods = useOptionsList("payment-methods", "name");
  const discountReasons = useOptionsList("reason-codes/options", "label", "category=discount");
  const { terminalId: rememberedTerminalId, setTerminalId: rememberTerminalId } =
    useSelectedTerminal();

  const [billType, setBillType] = useState<"cash_bill" | "credit_bill">("cash_bill");
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState<{ id: string; name: string } | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [starting, setStarting] = useState(false);

  const [bill, setBill] = useState<BillDetail | null>(null);
  const [completedBill, setCompletedBill] = useState<BillDetail | null>(null);
  const [heldDocumentNumber, setHeldDocumentNumber] = useState<string | null>(null);
  const [heldCount, setHeldCount] = useState(0);

  async function refetchHeldCount() {
    const res = await fetch("/api/bills?status=held&pageSize=1&countOnly=1");
    if (res.ok) {
      const body = (await res.json()) as { totalRecords: number };
      setHeldCount(body.totalRecords);
    }
  }

  const [scanValue, setScanValue] = useState("");
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [billDiscountAmount, setBillDiscountAmount] = useState("");
  const [billDiscountReasonCodeId, setBillDiscountReasonCodeId] = useState<string | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  async function refetchBill(id: string) {
    const res = await fetch(`/api/bills/${id}`);
    if (res.ok) setBill(await res.json());
  }

  useEffect(() => {
    const resumeId = searchParams.get("billId");
    if (resumeId) void refetchBill(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rememberedTerminalId && !terminalId) setTerminalId(rememberedTerminalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberedTerminalId]);

  useEffect(() => {
    if (!bill) void refetchHeldCount();
  }, [bill]);

  useEffect(() => {
    if (bill && bill.status === "draft") scanInputRef.current?.focus();
  }, [bill]);

  // Pre-fill the whole-bill discount input from what's already on the bill
  // when switching to it — but only on that switch, not on every refetch,
  // so it doesn't fight with the cashier's own in-progress typing.
  useEffect(() => {
    if (bill) setBillDiscountAmount(Number(bill.overallDiscount) > 0 ? bill.overallDiscount : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id]);

  async function startBill() {
    if (!terminalId) {
      toast.error("Select a terminal.");
      return;
    }
    if (billType === "credit_bill" && !customerId) {
      toast.error("A Credit Bill requires a customer.");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billType, terminalId, customerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to start bill.");
        return;
      }
      const created = (await res.json()) as { id: string };
      rememberTerminalId(terminalId);
      await refetchBill(created.id);
    } finally {
      setStarting(false);
    }
  }

  async function searchProducts(term: string) {
    if (!term || !bill) {
      setProductMatches([]);
      return;
    }
    const res = await fetch(`/api/products?search=${encodeURIComponent(term)}&pageSize=10`);
    const body = (await res.json().catch(() => null)) as { data: ProductMatch[] } | null;
    const products = body?.data ?? [];
    const exact = products.find((p) => p.systemBarcode === term || p.skuBarcode === term);

    if (exact) {
      await addProduct(exact.id);
      return;
    }
    setProductMatches(products);
  }

  const debouncedScanValue = useDebouncedValue(scanValue, 300);
  useEffect(() => {
    void searchProducts(debouncedScanValue.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedScanValue]);

  async function addProduct(productId: string) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to add item.");
      return;
    }
    setScanValue("");
    setProductMatches([]);
    await refetchBill(bill.id);
    scanInputRef.current?.focus();
  }

  async function removeLine(lineId: string) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/lines/${lineId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to remove item.");
      return;
    }
    await refetchBill(bill.id);
  }

  async function attachCustomer(newCustomerId: string | null) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: newCustomerId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to update customer.");
      return;
    }
    toast.success("Customer updated.");
    await refetchBill(bill.id);
  }

  async function updateLineQuantity(lineId: string, quantity: number) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to update quantity.");
      return;
    }
    await refetchBill(bill.id);
  }

  async function updateLineDiscount(lineId: string, discountApplied: number) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/lines/${lineId}/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountApplied }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to update discount.");
      return;
    }
    await refetchBill(bill.id);
  }

  async function recordPayment() {
    if (!bill || !paymentMethodId || remaining <= 0) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId, amount: remaining }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to record payment.");
        return;
      }
      toast.success("Payment recorded.");
      await refetchBill(bill.id);
    } finally {
      setPaying(false);
    }
  }

  async function applyBillDiscount() {
    if (!bill) return;
    const overallDiscount = Number(billDiscountAmount);
    if (!billDiscountAmount || overallDiscount <= 0) {
      toast.error("Enter a discount amount.");
      return;
    }
    if (activeLines.length === 0) {
      toast.error("Add items first.");
      return;
    }

    setApplyingDiscount(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallDiscount,
          discountReasonCodeId: billDiscountReasonCodeId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to apply discount.");
        return;
      }
      toast.success("Discount applied to the bill.");
      await refetchBill(bill.id);
    } finally {
      setApplyingDiscount(false);
    }
  }

  const debouncedBillDiscountAmount = useDebouncedValue(billDiscountAmount, 600);
  useEffect(() => {
    if (!bill) return;
    if (!debouncedBillDiscountAmount || Number(debouncedBillDiscountAmount) <= 0) return;
    void applyBillDiscount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBillDiscountAmount, billDiscountReasonCodeId]);

  async function holdBill() {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/hold`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? "Failed to hold bill.");
      return;
    }
    toast.success("Bill held.");
    setHeldDocumentNumber(bill.documentNumber);
    setBill(null);
  }

  async function discardEmptyBill() {
    if (!bill) return;
    setBill(null);
  }

  async function completeBill() {
    if (!bill) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to complete bill.");
        return;
      }
      const completed = (await res.json()) as BillDetail;
      toast.success("Bill completed.");
      setCompletedBill(completed);
      setBill(null);
    } finally {
      setCompleting(false);
    }
  }

  function startNewBill() {
    setCompletedBill(null);
    setHeldDocumentNumber(null);
    setBill(null);
    setCustomerId(null);
    setTerminalId(rememberedTerminalId);
  }

  const totalPaid =
    bill?.payments
      .filter((p) => p.status === "success")
      .reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const remaining = bill ? Math.max(0, Number(bill.grandTotal) - totalPaid) : 0;
  const activeLines = bill?.lines.filter((l) => l.status === "active") ?? [];

  if (completedBill) {
    return (
      <div className="space-y-4 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bill completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Document number: </span>
              {completedBill.documentNumber}
            </p>
            <p>
              <span className="text-muted-foreground">Grand total: </span>₹
              {money(completedBill.grandTotal)}
            </p>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Link
              href={`/bills/${completedBill.id}`}
              className="text-muted-foreground text-sm hover:underline"
            >
              View bill
            </Link>
            <Button onClick={startNewBill}>Start new bill</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (heldDocumentNumber) {
    return (
      <div className="space-y-4 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bill held</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              <span className="text-muted-foreground">Document number: </span>
              {heldDocumentNumber}
            </p>
            <p className="text-muted-foreground mt-2">
              Pick it back up any time from Held Bills, or start billing another customer now.
            </p>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Link href="/billing/held" className={buttonVariants({ variant: "outline" })}>
              Held bills
            </Link>
            <Button onClick={startNewBill}>Start new bill</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-4 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Billing</h1>
          <Link
            href="/billing/held"
            className={buttonVariants({ variant: heldCount > 0 ? "default" : "outline" })}
          >
            Held bills{heldCount > 0 ? ` (${heldCount})` : ""}
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Start a bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Bill type
                <RequiredMark />
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={billType === "cash_bill" ? "default" : "outline"}
                  onClick={() => setBillType("cash_bill")}
                >
                  Cash Bill
                </Button>
                <Button
                  type="button"
                  variant={billType === "credit_bill" ? "default" : "outline"}
                  onClick={() => setBillType("credit_bill")}
                >
                  Credit Bill
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Terminal
                <RequiredMark />
              </Label>
              <SearchableSelect
                options={terminals}
                value={terminalId}
                onChange={setTerminalId}
                placeholder="Select terminal…"
              />
            </div>

            {billType === "credit_bill" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Customer
                    <RequiredMark />
                  </Label>
                  {!showNewCustomerForm && (
                    <button
                      type="button"
                      className="text-primary text-xs hover:underline"
                      onClick={() => setShowNewCustomerForm(true)}
                    >
                      + New customer
                    </button>
                  )}
                </div>

                {showNewCustomerForm ? (
                  <NewCustomerInlineForm
                    storeId={session?.user.storeId ?? ""}
                    onCancel={() => setShowNewCustomerForm(false)}
                    onCreated={(created) => {
                      setNewCustomer(created);
                      setCustomerId(created.id);
                      setShowNewCustomerForm(false);
                    }}
                  />
                ) : (
                  <SearchableSelect
                    options={
                      newCustomer && !customers.some((c) => c.value === newCustomer.id)
                        ? [{ value: newCustomer.id, label: newCustomer.name }, ...customers]
                        : customers
                    }
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Select customer…"
                  />
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={startBill} disabled={starting}>
              {starting ? "Starting…" : "Start bill"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{bill.documentNumber}</h1>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span>
              {bill.customer
                ? `${bill.customer.name}${bill.customer.phone ? ` — ${bill.customer.phone}` : ""}`
                : "Walk-in customer"}
            </span>
            <span>·</span>
            <span>{bill.billType === "credit_bill" ? "Credit Bill" : "Cash Bill"}</span>
            {!showNewCustomerForm && bill.billType !== "credit_bill" && (
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setShowNewCustomerForm(true)}
              >
                {bill.customer ? "Change" : "Add customer"}
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={holdBill}>
            Hold
          </Button>
          {activeLines.length === 0 && (
            <Button variant="outline" onClick={discardEmptyBill}>
              Discard
            </Button>
          )}
        </div>
      </div>

      {showNewCustomerForm && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="space-y-1.5">
              <Label>Existing customer</Label>
              <SearchableSelect
                options={customers}
                value={customerId}
                onChange={(v) => {
                  setCustomerId(v);
                  if (v) {
                    void attachCustomer(v);
                    setShowNewCustomerForm(false);
                  }
                }}
                placeholder="Select customer…"
              />
            </div>
            <NewCustomerInlineForm
              storeId={session?.user.storeId ?? ""}
              onCancel={() => setShowNewCustomerForm(false)}
              onCreated={(created) => {
                setNewCustomer(created);
                void attachCustomer(created.id);
                setShowNewCustomerForm(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 pt-6">
          <Input
            ref={scanInputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchProducts(scanValue.trim());
              }
            }}
            placeholder="Scan or search a product…"
            autoFocus
          />
          {productMatches.length > 0 && (
            <div className="divide-y rounded-lg border">
              {productMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void addProduct(p.id)}
                  className="hover:bg-muted/50 flex w-full items-center justify-between p-2 text-left text-sm"
                >
                  <span>
                    {p.name} <span className="text-muted-foreground">· {p.systemBarcode}</span>
                  </span>
                  <span>₹{money(p.price)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeLines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  Scan or search a product to add it.
                </TableCell>
              </TableRow>
            )}
            {activeLines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div>{line.productName}</div>
                  <div className="text-muted-foreground text-xs">{line.productBarcode}</div>
                  {line.allocations.length > 0 && (
                    <LineWarehouseSplit
                      billId={bill.id}
                      lineId={line.id}
                      quantity={line.quantity}
                      allocations={line.allocations}
                      onUpdated={() => void refetchBill(bill.id)}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <EditableLineValue
                    value={line.quantity}
                    min={1}
                    onCommit={(next) => void updateLineQuantity(line.id, next)}
                  />
                </TableCell>
                <TableCell>₹{money(line.unitPrice)}</TableCell>
                <TableCell>
                  <EditableLineValue
                    value={Number(line.discountApplied ?? 0)}
                    min={0}
                    onCommit={(next) => void updateLineDiscount(line.id, next)}
                  />
                </TableCell>
                <TableCell>₹{money(line.taxBreakdown?.taxAmount ?? 0)}</TableCell>
                <TableCell>₹{money(line.lineTotal)}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => void removeLine(line.id)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{money(bill.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>₹{money(bill.discountTotal)}</span>
            </div>

            <div className="grid grid-cols-2 items-end gap-2 py-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  Discount whole bill{applyingDiscount ? " — applying…" : ""}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={billDiscountAmount}
                  onChange={(e) => setBillDiscountAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <SearchableSelect
                  options={discountReasons}
                  value={billDiscountReasonCodeId}
                  onChange={setBillDiscountReasonCodeId}
                  placeholder="Select reason…"
                />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>₹{money(bill.taxTotal)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Grand total</span>
              <span>₹{money(bill.grandTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>₹{money(totalPaid)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Remaining</span>
              <span>₹{money(remaining)}</span>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={completeBill} disabled={completing || remaining > 0.01}>
              {completing ? "Completing…" : "Complete bill"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <SearchableSelect
                options={paymentMethods}
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                placeholder="Select payment method…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="text" value={`₹${remaining.toFixed(2)}`} readOnly disabled />
            </div>
            <Button
              variant="outline"
              onClick={recordPayment}
              disabled={paying || !paymentMethodId || remaining <= 0}
            >
              {paying ? "Recording…" : "Record payment"}
            </Button>

            {bill.payments.length > 0 && (
              <div className="divide-y border-t pt-2 text-sm">
                {bill.payments.map((p) => (
                  <div key={p.id} className="flex justify-between py-1">
                    <span>
                      {p.paymentMethod.name}{" "}
                      <span className="text-muted-foreground">({p.status})</span>
                    </span>
                    <span>₹{money(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!session?.user.storeId && (
        <p className="text-muted-foreground text-sm">
          A Super Admin session has no single store — sign in as a store user to bill.
        </p>
      )}
    </div>
  );
}
