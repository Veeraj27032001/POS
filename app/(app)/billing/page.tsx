"use client";

import { Loader2Icon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CustomerDetailsFields,
  emptyCustomerDraft,
  type CustomerDraft,
} from "@/components/billing/customer-details-fields";
import { EditableLineValue } from "@/components/billing/editable-line-value";
import { LineWarehouseSplit } from "@/components/billing/line-warehouse-split";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
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

interface Allocation {
  warehouseId: string;
  quantity: number;
}

interface CartLine {
  productId: string;
  productName: string;
  productBarcode: string;
  price: number;
  stockTracked: boolean;
  quantity: number;
  discountApplied: number;
  discountReasonCodeId: string | null;
  // null = use whatever the server auto-allocates; set = the cashier's
  // manual override, sent as `requested` on the next save. The server
  // falls back to auto-allocation if this has gone stale by save time.
  manualAllocations: Allocation[] | null;
  // Sync bookkeeping — null until this line has actually been saved to the
  // server at least once. syncedQuantity/syncedDiscount/syncedAllocations
  // track what the server currently has, so a later save only sends what
  // changed.
  serverId: string | null;
  syncedQuantity: number;
  syncedDiscount: number;
  syncedAllocations: Allocation[] | null;
}

interface ProductMatch {
  id: string;
  name: string;
  systemBarcode: string;
  skuBarcode: string | null;
  price: string;
  stockTracked: boolean;
}

interface PreviewLine {
  productId: string;
  tax: { taxAmount: number };
  lineTotal: number;
  allocations: { warehouseId: string; warehouseName: string; quantity: number }[];
  allocationWarning: string | null;
  warehouseAvailability: { warehouseId: string; warehouseName: string; available: number }[];
}

interface PreviewTotals {
  lines: PreviewLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

interface CompletedBill {
  id: string;
  documentNumber: string;
  grandTotal: string;
}

interface CartPayment {
  paymentMethodId: string;
  paymentMethodLabel: string;
  amount: number;
}

interface ExistingPayment {
  id: string;
  amount: string;
  status: string;
  paymentMethod: { name: string };
}

interface CustomerRecord {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  countryId: string | null;
  stateId: string | null;
  pincode: string | null;
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

function sortedAllocations(allocations: Allocation[] | null): Allocation[] {
  if (!allocations) return [];
  return [...allocations].sort((a, b) => a.warehouseId.localeCompare(b.warehouseId));
}

function draftFrom(c: Partial<CustomerRecord> | null): CustomerDraft {
  return {
    name: c?.name ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    address: c?.address ?? "",
    countryId: c?.countryId ?? null,
    stateId: c?.stateId ?? null,
    pincode: c?.pincode ?? "",
  };
}

const emptyPreview: PreviewTotals = {
  lines: [],
  subtotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 0,
};

// The whole cart — products, quantities, discounts, customer details,
// payment — lives only in this component's state. Nothing reaches the
// server until the cashier explicitly clicks Save draft, Hold, or Create
// bill (syncCart, below); those are the only three points where anything
// here is actually persisted.
export default function BillingPage() {
  const { data } = useSession();
  const session = asAppSession(data ?? null);
  const searchParams = useSearchParams();

  const terminals = useOptionsList("terminals", "name");
  const customers = useOptionsList("customers", "name");
  const paymentMethods = useOptionsList("payment-methods/options", "name");
  const discountReasons = useOptionsList("reason-codes/options", "label", "category=discount");
  const { terminalId: rememberedTerminalId, setTerminalId: rememberTerminalId } =
    useSelectedTerminal();
  const currencySymbol = useStoreCurrencySymbol();

  const [billType, setBillType] = useState<"cash_bill" | "credit_bill">("cash_bill");
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  // Set once a save has actually created the bill on the server — reused so
  // a later save updates that same bill instead of creating a duplicate.
  const [savedBillId, setSavedBillId] = useState<string | null>(null);
  const [savedDocumentNumber, setSavedDocumentNumber] = useState<string | null>(null);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  // A line removed locally after it was already synced (has a serverId)
  // has to be voided server-side on the next save too — otherwise it just
  // silently stays there (and stays blocked, once Hold is involved).
  const [removedServerLineIds, setRemovedServerLineIds] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(emptyCustomerDraft);
  const [customerStateId, setCustomerStateId] = useState<string | null>(null);
  const [overallDiscount, setOverallDiscount] = useState("");
  const [overallDiscountReasonCodeId, setOverallDiscountReasonCodeId] = useState<string | null>(
    null,
  );

  const [completedBill, setCompletedBill] = useState<CompletedBill | null>(null);
  const [heldDocumentNumber, setHeldDocumentNumber] = useState<string | null>(null);
  const [heldCount, setHeldCount] = useState(0);

  const [scanValue, setScanValue] = useState("");
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [searchAvailability, setSearchAvailability] = useState<Record<string, number>>({});
  const [highlightedMatch, setHighlightedMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [cartPayments, setCartPayments] = useState<CartPayment[]>([]);
  const [existingPayments, setExistingPayments] = useState<ExistingPayment[]>([]);

  const [savingDraft, setSavingDraft] = useState(false);
  const [holding, setHolding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  // Save draft / Hold / Create bill all sync the same cart to the server —
  // letting two of them fire at once would race. Only one at a time.
  const busy = savingDraft || holding || creating || discarding;

  const [preview, setPreview] = useState<PreviewTotals>(emptyPreview);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function refetchHeldCount() {
    const res = await fetch("/api/bills?status=held&pageSize=1&countOnly=1");
    if (res.ok) {
      const body = (await res.json()) as { totalRecords: number };
      setHeldCount(body.totalRecords);
    }
  }

  useEffect(() => {
    if (!started) void refetchHeldCount();
  }, [started]);

  useEffect(() => {
    if (rememberedTerminalId && !terminalId) setTerminalId(rememberedTerminalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberedTerminalId]);

  useEffect(() => {
    if (started) scanInputRef.current?.focus();
  }, [started]);

  // Resuming a held bill: it already exists on the server with real lines,
  // so load it into the same local cart state everything else uses —
  // further edits stay local until the next explicit save, same as a bill
  // that's brand new.
  useEffect(() => {
    const resumeId = searchParams.get("billId");
    if (resumeId) void loadForResume(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadForResume(id: string) {
    const res = await fetch(`/api/bills/${id}`);
    if (!res.ok) return;
    const b = await res.json();
    setBillType(b.billType);
    setTerminalId(b.terminalId);
    setSavedBillId(b.id);
    setSavedDocumentNumber(b.documentNumber);
    setCartLines(
      (b.lines as Array<Record<string, unknown>>)
        .filter((l) => l.status === "active")
        .map((l) => {
          const allocations = (
            l.allocations as Array<{ warehouseId: string; quantity: number }>
          ).map((a) => ({ warehouseId: a.warehouseId, quantity: a.quantity }));
          return {
            productId: l.productId as string,
            productName: l.productName as string,
            productBarcode: l.productBarcode as string,
            price: Number(l.unitPrice),
            stockTracked: Boolean((l.product as { stockTracked: boolean }).stockTracked),
            quantity: l.quantity as number,
            discountApplied: Number(l.discountApplied ?? 0),
            discountReasonCodeId: null,
            manualAllocations: null,
            serverId: l.id as string,
            syncedQuantity: l.quantity as number,
            syncedDiscount: Number(l.discountApplied ?? 0),
            syncedAllocations: allocations,
          };
        }),
    );
    if (b.customer) {
      setSelectedCustomerId(b.customer.id);
      setCustomerDraft(draftFrom(b.customer));
      setCustomerStateId(b.customer.stateId ?? null);
    } else {
      setSelectedCustomerId(null);
      setCustomerDraft(
        draftFrom({
          name: b.customerName,
          phone: b.customerPhone,
          email: b.customerEmail,
          address: b.customerAddress,
          countryId: b.customerCountryId,
          stateId: b.customerStateId,
          pincode: b.customerPincode,
        }),
      );
      setCustomerStateId(b.customerStateId ?? null);
    }
    setOverallDiscount(Number(b.overallDiscount) > 0 ? String(b.overallDiscount) : "");
    setExistingPayments(b.payments ?? []);
    setStarted(true);
  }

  function startBill() {
    if (!terminalId) {
      toast.error("Select a terminal.");
      return;
    }
    rememberTerminalId(terminalId);
    setStarted(true);
  }

  async function searchProducts(term: string) {
    if (!term) {
      setProductMatches([]);
      setSearchAvailability({});
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(term)}&pageSize=10`);
      const body = (await res.json().catch(() => null)) as { data: ProductMatch[] } | null;
      const products = body?.data ?? [];
      const exact = products.find((p) => p.systemBarcode === term || p.skuBarcode === term);
      if (exact) {
        addProduct(exact);
        return;
      }
      setProductMatches(products);
      setHighlightedMatch(0);
      void loadSearchAvailability(products);
    } finally {
      setSearching(false);
    }
  }

  async function loadSearchAvailability(products: ProductMatch[]) {
    const productIds = products.filter((p) => p.stockTracked).map((p) => p.id);
    if (productIds.length === 0) {
      setSearchAvailability({});
      return;
    }
    const res = await fetch("/api/bills/product-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { availability: { productId: string; available: number }[] };
    setSearchAvailability(
      Object.fromEntries(body.availability.map((a) => [a.productId, a.available])),
    );
  }

  const debouncedScanValue = useDebouncedValue(scanValue, 300);
  useEffect(() => {
    void searchProducts(debouncedScanValue.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedScanValue]);

  // Purely local — no request. The same product scanned again just
  // increments the existing cart line instead of creating a second one.
  function addProduct(product: ProductMatch) {
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          productBarcode: product.systemBarcode,
          price: Number(product.price),
          stockTracked: product.stockTracked,
          quantity: 1,
          discountApplied: 0,
          discountReasonCodeId: null,
          manualAllocations: null,
          serverId: null,
          syncedQuantity: 0,
          syncedDiscount: 0,
          syncedAllocations: null,
        },
      ];
    });
    setScanValue("");
    setProductMatches([]);
    scanInputRef.current?.focus();
  }

  function removeLine(productId: string) {
    setCartLines((prev) => {
      const line = prev.find((l) => l.productId === productId);
      if (line?.serverId) {
        setRemovedServerLineIds((ids) => [...ids, line.serverId!]);
      }
      return prev.filter((l) => l.productId !== productId);
    });
  }

  // Changing quantity invalidates any manual warehouse split (it no longer
  // sums to the new quantity) — reverts to automatic, matching the
  // established rule that allocation is redone by default on every
  // quantity change.
  function updateLineQuantity(productId: string, quantity: number) {
    setCartLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity, manualAllocations: null } : l,
      ),
    );
  }

  function updateLineDiscount(productId: string, discountApplied: number) {
    setCartLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, discountApplied } : l)),
    );
  }

  function setLineAllocations(productId: string, allocations: Allocation[]) {
    setCartLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, manualAllocations: allocations } : l)),
    );
  }

  function clearLineAllocations(productId: string) {
    setCartLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, manualAllocations: null } : l)),
    );
  }

  async function selectExistingCustomer(customerId: string) {
    const res = await fetch(`/api/customers/${customerId}`);
    if (!res.ok) return;
    const c = (await res.json()) as CustomerRecord;
    setSelectedCustomerId(customerId);
    setCustomerDraft(draftFrom(c));
    setCustomerStateId(c.stateId ?? null);
  }

  function onCustomerDraftChange(next: CustomerDraft) {
    setSelectedCustomerId(null);
    setCustomerDraft(next);
    setCustomerStateId(next.stateId);
  }

  // Read-only totals preview (including real GST tax rules) for the cart as
  // it stands right now — a pure computation, nothing here is persisted.
  const previewKey = JSON.stringify({
    lines: cartLines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      discountApplied: l.discountApplied,
      allocations: l.manualAllocations ?? undefined,
    })),
    overallDiscount: Number(overallDiscount) || 0,
    customerStateId,
  });
  const debouncedPreviewKey = useDebouncedValue(previewKey, 400);
  useEffect(() => {
    if (!started) return;
    const payload = JSON.parse(debouncedPreviewKey) as {
      lines: { productId: string; quantity: number; discountApplied: number }[];
    };
    if (payload.lines.length === 0) {
      setPreview(emptyPreview);
      return;
    }
    setLoadingPreview(true);
    fetch("/api/bills/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: debouncedPreviewKey,
    })
      .then((res) => (res.ok ? (res.json() as Promise<PreviewTotals>) : null))
      .then((body) => {
        if (body) setPreview(body);
      })
      .finally(() => setLoadingPreview(false));
  }, [debouncedPreviewKey, started]);

  function totalForLine(productId: string): number {
    return preview.lines.find((l) => l.productId === productId)?.lineTotal ?? 0;
  }

  function taxForLine(productId: string): number {
    return preview.lines.find((l) => l.productId === productId)?.tax.taxAmount ?? 0;
  }

  function allocationsForLine(
    productId: string,
  ): { warehouseId: string; warehouseName: string; quantity: number }[] {
    return preview.lines.find((l) => l.productId === productId)?.allocations ?? [];
  }

  function allocationWarningForLine(productId: string): string | null {
    return preview.lines.find((l) => l.productId === productId)?.allocationWarning ?? null;
  }

  function warehouseAvailabilityForLine(
    productId: string,
  ): { warehouseId: string; warehouseName: string; available: number }[] {
    return preview.lines.find((l) => l.productId === productId)?.warehouseAvailability ?? [];
  }

  // Truly out of stock — resolveAllocations couldn't find anywhere to put
  // it at all — as opposed to a stale manual override that still resolved
  // fine via automatic fallback (has a warning but real allocations too).
  function isOutOfStock(productId: string): boolean {
    return (
      allocationWarningForLine(productId) !== null && allocationsForLine(productId).length === 0
    );
  }

  // The only place anything here actually reaches the server. Creates the
  // bill on first save; on every save after that it only sends whatever
  // changed since the last one (new lines, changed quantities/discounts,
  // customer, whole-bill discount).
  async function syncCart(): Promise<string | null> {
    let billId = savedBillId;
    if (!billId) {
      if (!terminalId) {
        toast.error("Select a terminal.");
        return null;
      }
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billType, terminalId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save bill.");
        return null;
      }
      const created = (await res.json()) as { id: string; documentNumber: string };
      billId = created.id;
      setSavedBillId(created.id);
      setSavedDocumentNumber(created.documentNumber);
    }

    for (const lineId of removedServerLineIds) {
      const res = await fetch(`/api/bills/${billId}/lines/${lineId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to remove an item.");
        return null;
      }
    }
    setRemovedServerLineIds([]);

    const nextLines = [...cartLines];
    for (let i = 0; i < nextLines.length; i++) {
      const line = nextLines[i];
      const allocationsChanged =
        JSON.stringify(sortedAllocations(line.manualAllocations)) !==
        JSON.stringify(sortedAllocations(line.syncedAllocations));

      if (!line.serverId) {
        const res = await fetch(`/api/bills/${billId}/lines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: line.productId,
            quantity: line.quantity,
            allocations: line.manualAllocations ?? undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(body?.error?.message ?? `Failed to save ${line.productName}.`);
          setCartLines(nextLines);
          return null;
        }
        const body = (await res.json()) as { line: { id: string }; warning?: string };
        if (body.warning) toast.warning(body.warning);
        nextLines[i] = {
          ...line,
          serverId: body.line.id,
          syncedQuantity: line.quantity,
          syncedAllocations: line.manualAllocations,
        };
      } else if (line.quantity !== line.syncedQuantity || allocationsChanged) {
        const res = await fetch(`/api/bills/${billId}/lines/${line.serverId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: line.quantity,
            allocations: line.manualAllocations ?? undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(body?.error?.message ?? `Failed to update ${line.productName}.`);
          setCartLines(nextLines);
          return null;
        }
        nextLines[i] = {
          ...line,
          syncedQuantity: line.quantity,
          syncedAllocations: line.manualAllocations,
        };
      }

      if (nextLines[i].discountApplied !== nextLines[i].syncedDiscount) {
        const res = await fetch(`/api/bills/${billId}/lines/${nextLines[i].serverId}/discount`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discountApplied: nextLines[i].discountApplied,
            discountReasonCodeId: nextLines[i].discountReasonCodeId,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(
            body?.error?.message ?? `Failed to update discount on ${nextLines[i].productName}.`,
          );
          setCartLines(nextLines);
          return null;
        }
        nextLines[i] = { ...nextLines[i], syncedDiscount: nextLines[i].discountApplied };
      }
    }
    setCartLines(nextLines);

    if (selectedCustomerId) {
      await fetch(`/api/bills/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomerId }),
      });
    } else if (Object.values(customerDraft).some((v) => !!v)) {
      await fetch(`/api/bills/${billId}/customer-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerDraft),
      });
    }

    const overallDiscountNumber = Number(overallDiscount) || 0;
    if (overallDiscountNumber > 0) {
      const res = await fetch(`/api/bills/${billId}/discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallDiscount: overallDiscountNumber,
          discountReasonCodeId: overallDiscountReasonCodeId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to apply the whole-bill discount.");
        return null;
      }
    }

    return billId;
  }

  async function saveDraft() {
    if (cartLines.length === 0) {
      toast.error("Add items first.");
      return;
    }
    setSavingDraft(true);
    try {
      const billId = await syncCart();
      if (billId) toast.success("Draft saved.");
    } finally {
      setSavingDraft(false);
    }
  }

  function resetCart() {
    setCartLines([]);
    setRemovedServerLineIds([]);
    setSelectedCustomerId(null);
    setCustomerDraft(emptyCustomerDraft);
    setCustomerStateId(null);
    setOverallDiscount("");
    setOverallDiscountReasonCodeId(null);
    setCartPayments([]);
    setExistingPayments([]);
    setPaymentMethodId(null);
    setSavedBillId(null);
    setSavedDocumentNumber(null);
    setPreview(emptyPreview);
    setStarted(false);
  }

  async function holdBill() {
    if (cartLines.length === 0) {
      toast.error("Add items first.");
      return;
    }
    setHolding(true);
    try {
      const billId = await syncCart();
      if (!billId) return;
      const res = await fetch(`/api/bills/${billId}/hold`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to hold bill.");
        return;
      }
      const held = (await res.json()) as { documentNumber: string };
      toast.success("Bill held.");
      setHeldDocumentNumber(held.documentNumber);
      resetCart();
    } finally {
      setHolding(false);
    }
  }

  function discardCart() {
    if (!savedBillId) {
      resetCart();
      return;
    }
    setDiscarding(true);
    void (async () => {
      try {
        const res = await fetch(`/api/bills/${savedBillId}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(body?.error?.message ?? "Failed to discard bill.");
          return;
        }
        resetCart();
      } finally {
        setDiscarding(false);
      }
    })();
  }

  function addPayment() {
    if (!paymentMethodId || remaining <= 0) return;
    const method = paymentMethods.find((m) => m.value === paymentMethodId);
    setCartPayments((prev) => [
      ...prev,
      { paymentMethodId, paymentMethodLabel: method?.label ?? "", amount: remaining },
    ]);
    setPaymentMethodId(null);
  }

  function removePayment(index: number) {
    setCartPayments((prev) => prev.filter((_, i) => i !== index));
  }

  async function createBill() {
    if (cartLines.length === 0) {
      toast.error("Add items first.");
      return;
    }
    if (remaining > 0.01) {
      toast.error("Record full payment first.");
      return;
    }
    setCreating(true);
    try {
      const billId = await syncCart();
      if (!billId) return;
      for (const payment of cartPayments) {
        const res = await fetch(`/api/bills/${billId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethodId: payment.paymentMethodId,
            amount: payment.amount,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(body?.error?.message ?? "Failed to record payment.");
          return;
        }
      }
      const res = await fetch(`/api/bills/${billId}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to create bill.");
        return;
      }
      const completed = (await res.json()) as CompletedBill;
      toast.success("Bill created.");
      setCompletedBill(completed);
      resetCart();
    } finally {
      setCreating(false);
    }
  }

  function startNewBill() {
    setCompletedBill(null);
    setHeldDocumentNumber(null);
    resetCart();
    setTerminalId(rememberedTerminalId);
  }

  const existingPaidTotal = existingPayments
    .filter((p) => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = existingPaidTotal + cartPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, preview.grandTotal - totalPaid);
  const customerSummary = selectedCustomerId
    ? (customers.find((c) => c.value === selectedCustomerId)?.label ?? null)
    : customerDraft.name || null;

  if (completedBill) {
    return (
      <div className="space-y-4 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Bill created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Document number: </span>
              {completedBill.documentNumber}
            </p>
            <p>
              <span className="text-muted-foreground">Grand total: </span>
              {currencySymbol}
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

  if (!started) {
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

        {session && !session.user.storeId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Start a bill</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                A Super Admin session has no single store — sign in as a store user to bill.
              </p>
            </CardContent>
          </Card>
        ) : (
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
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={startBill}>Start bill</Button>
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{savedDocumentNumber ?? "New bill"}</h1>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span>{customerSummary ?? "Walk-in customer"}</span>
            <span>·</span>
            <span>{billType === "credit_bill" ? "Credit Bill" : "Cash Bill"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {cartLines.length === 0 && (
            <Button variant="outline" onClick={discardCart} disabled={busy}>
              {discarding ? "Discarding…" : "Discard"}
            </Button>
          )}
          <Button variant="outline" onClick={saveDraft} disabled={busy}>
            {savingDraft ? "Saving…" : "Save draft"}
          </Button>
          <Button variant="outline" onClick={holdBill} disabled={busy}>
            {holding ? "Holding…" : "Hold"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerDetailsFields
            selectedCustomerId={selectedCustomerId}
            draft={customerDraft}
            customers={customers}
            onSelectExisting={(v) => void selectExistingCustomer(v)}
            onChange={onCustomerDraftChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="relative">
            <Input
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedMatch((i) => Math.min(i + 1, productMatches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedMatch((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (productMatches.length > 0) {
                    const target = productMatches[highlightedMatch] ?? productMatches[0];
                    addProduct(target);
                  } else {
                    void searchProducts(scanValue.trim());
                  }
                }
              }}
              placeholder="Scan or search a product…"
              autoFocus
            />
            {searching && (
              <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
            )}
          </div>
          {productMatches.length > 0 && (
            <div className="divide-y rounded-lg border">
              {productMatches.map((p, index) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  onMouseEnter={() => setHighlightedMatch(index)}
                  className={`flex w-full items-center justify-between p-2 text-left text-sm ${
                    index === highlightedMatch ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <span>
                    {p.name} <span className="text-muted-foreground">· {p.systemBarcode}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {currencySymbol}
                    {money(p.price)}
                    {p.stockTracked && p.id in searchAvailability && (
                      <span
                        className={
                          searchAvailability[p.id] > 0 ? "text-success" : "text-destructive"
                        }
                      >
                        {searchAvailability[p.id]} in stock
                      </span>
                    )}
                  </span>
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
            {cartLines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  Scan or search a product to add it.
                </TableCell>
              </TableRow>
            )}
            {cartLines.map((line) => (
              <TableRow key={line.productId}>
                <TableCell>
                  <div className={isOutOfStock(line.productId) ? "text-destructive" : undefined}>
                    {line.productName}
                  </div>
                  <div className="text-muted-foreground text-xs">{line.productBarcode}</div>
                  {isOutOfStock(line.productId) && (
                    <div className="text-destructive text-xs">Out of stock</div>
                  )}
                  {line.stockTracked && (
                    <LineWarehouseSplit
                      productName={line.productName}
                      quantity={line.quantity}
                      allocations={allocationsForLine(line.productId)}
                      warehouseAvailability={warehouseAvailabilityForLine(line.productId)}
                      hasManualOverride={line.manualAllocations !== null}
                      warning={allocationWarningForLine(line.productId)}
                      loading={loadingPreview}
                      onSave={(allocations) => setLineAllocations(line.productId, allocations)}
                      onClearOverride={() => clearLineAllocations(line.productId)}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <EditableLineValue
                    value={line.quantity}
                    min={1}
                    onCommit={(next) => updateLineQuantity(line.productId, next)}
                  />
                </TableCell>
                <TableCell>
                  {currencySymbol}
                  {money(line.price)}
                </TableCell>
                <TableCell>
                  <EditableLineValue
                    value={line.discountApplied}
                    min={0}
                    onCommit={(next) => updateLineDiscount(line.productId, next)}
                  />
                </TableCell>
                <TableCell>
                  {currencySymbol}
                  {money(taxForLine(line.productId))}
                </TableCell>
                <TableCell>
                  {currencySymbol}
                  {money(totalForLine(line.productId))}
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeLine(line.productId)}
                  >
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
            <CardTitle className="text-base">
              Totals{loadingPreview ? " — calculating…" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {currencySymbol}
                {money(preview.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>
                {currencySymbol}
                {money(preview.discountTotal)}
              </span>
            </div>

            <div className="grid grid-cols-2 items-end gap-2 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Discount whole bill</Label>
                <Input
                  type="number"
                  min={0}
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <SearchableSelect
                  options={discountReasons}
                  value={overallDiscountReasonCodeId}
                  onChange={setOverallDiscountReasonCodeId}
                  placeholder="Select reason…"
                />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>
                {currencySymbol}
                {money(preview.taxTotal)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Grand total</span>
              <span>
                {currencySymbol}
                {money(preview.grandTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>
                {currencySymbol}
                {money(totalPaid)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Remaining</span>
              <span>
                {currencySymbol}
                {money(remaining)}
              </span>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={createBill}
              disabled={busy || remaining > 0.01 || cartLines.length === 0}
            >
              {creating ? "Creating…" : "Create bill"}
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
              <Input
                type="text"
                value={`${currencySymbol}${remaining.toFixed(2)}`}
                readOnly
                disabled
              />
            </div>
            <Button
              variant="outline"
              onClick={addPayment}
              disabled={!paymentMethodId || remaining <= 0}
            >
              Add payment
            </Button>

            {(existingPayments.length > 0 || cartPayments.length > 0) && (
              <div className="divide-y border-t pt-2 text-sm">
                {existingPayments.map((p) => (
                  <div key={p.id} className="flex justify-between py-1">
                    <span>
                      {p.paymentMethod.name}{" "}
                      <span className="text-muted-foreground">({p.status})</span>
                    </span>
                    <span>
                      {currencySymbol}
                      {money(p.amount)}
                    </span>
                  </div>
                ))}
                {cartPayments.map((p, index) => (
                  <div key={index} className="flex justify-between py-1">
                    <span>
                      {p.paymentMethodLabel} <span className="text-muted-foreground">(new)</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {currencySymbol}
                      {money(p.amount)}
                      <button
                        type="button"
                        className="text-muted-foreground text-xs hover:underline"
                        onClick={() => removePayment(index)}
                      >
                        Remove
                      </button>
                    </span>
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
