"use client";

import { Loader2Icon, SettingsIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CustomerDetailsFields,
  emptyCustomerDraft,
  type CustomerDraft,
} from "@/components/billing/customer-details-fields";
import { EditableLineValue } from "@/components/billing/editable-line-value";
import { LineWarehouseSplit } from "@/components/billing/line-warehouse-split";
import { ShiftControl } from "@/components/billing/shift-control";
import { getPrintBridge } from "@/lib/adapters/print";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useStoreCurrencySymbol } from "@/lib/hooks/useStoreCurrencySymbol";
import { useStoreDefaultExcludeTax } from "@/lib/hooks/useStoreDefaultExcludeTax";
import { useStorePaymentGatewayAvailable } from "@/lib/hooks/useStorePaymentGatewayAvailable";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { asAppSession } from "@/lib/auth/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  // null = auto-allocate; set = manual override sent as `requested`.
  manualAllocations: Allocation[] | null;
  // Sync bookkeeping — null until saved once; synced* track server state.
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
  lineDiscountTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

interface CompletedBill {
  id: string;
  documentNumber: string;
  grandTotal: string;
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
  lineDiscountTotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 0,
};

// The cart lives only in local state until Save draft/Hold/Create (syncCart).
export default function BillingPage() {
  const { data, status: sessionStatus } = useSession();
  const session = asAppSession(data ?? null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const terminals = useOptionsList("terminals", "name");
  const customers = useOptionsList("customers", "name");
  const paymentMethods = useOptionsList("payment-methods/options", "name");
  const discountReasons = useOptionsList("reason-codes/options", "label", "category=discount");
  const { terminalId: rememberedTerminalId, setTerminalId: rememberTerminalId } =
    useSelectedTerminal();
  const currencySymbol = useStoreCurrencySymbol();

  const [billType, setBillType] = useState<"cash_bill" | "credit_bill">("cash_bill");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [syncedBillDate, setSyncedBillDate] = useState<string | null>(null);
  const [excludeTax, setExcludeTax] = useState(false);
  // True from first render whenever the URL already carries ?billId= — hides
  // the "Start a bill" form during that fetch instead of flashing it first.
  const [resuming, setResuming] = useState(() => !!searchParams.get("billId"));

  const [terminalId, setTerminalId] = useState<string | null>(() =>
    resuming ? null : rememberedTerminalId,
  );
  const [started, setStarted] = useState(() => !resuming && !!rememberedTerminalId);

  // Set once a save creates the bill server-side, so later saves update it.
  const [savedBillId, setSavedBillId] = useState<string | null>(null);
  const [savedDocumentNumber, setSavedDocumentNumber] = useState<string | null>(null);
  // null = not saved yet (behaves like draft). "held" shows Save/Make draft;
  // anything else shows Save draft/Hold.
  const [billStatus, setBillStatus] = useState<"draft" | "held" | null>(null);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  // Lines removed after being synced still need voiding server-side.
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
  const [draftCount, setDraftCount] = useState(0);

  const [scanValue, setScanValue] = useState("");
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [searchAvailability, setSearchAvailability] = useState<Record<string, number>>({});
  const [highlightedMatch, setHighlightedMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [existingPayments, setExistingPayments] = useState<ExistingPayment[]>([]);

  const [savingDraft, setSavingDraft] = useState(false);
  const [holding, setHolding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [makingDraft, setMakingDraft] = useState(false);
  // Prevents two save actions racing each other.
  const busy = savingDraft || holding || creating || discarding || makingDraft;

  const [preview, setPreview] = useState<PreviewTotals>(emptyPreview);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function refetchHeldCount() {
    const res = await fetch("/api/bills?status=held&pageSize=1&countOnly=1");
    if (res.ok) {
      const body = (await res.json()) as { totalRecords: number };
      setHeldCount(body.totalRecords);
    }
  }

  async function refetchDraftCount() {
    const res = await fetch("/api/bills?status=draft&pageSize=1&countOnly=1");
    if (res.ok) {
      const body = (await res.json()) as { totalRecords: number };
      setDraftCount(body.totalRecords);
    }
  }

  useEffect(() => {
    if (!started) {
      void refetchHeldCount();
      void refetchDraftCount();
    }
  }, [started]);

  useEffect(() => {
    if (rememberedTerminalId && !terminalId) setTerminalId(rememberedTerminalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberedTerminalId]);

  // The customer field is deliberately the default focus target, not the
  // scan box — this store's workflow is to select/enter the customer
  // before scanning items. A physical barcode scanner only matters once
  // the cashier has actually tabbed/arrowed down into the scan box
  // themselves, so it doesn't need to hold focus by default here.
  useEffect(() => {
    if (started) document.getElementById("billing-existing-customer-select")?.focus();
  }, [started]);

  // Resuming loads the held bill's real lines into local cart state.
  useEffect(() => {
    const resumeId = searchParams.get("billId");
    if (resumeId) void loadForResume(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-check Exclude Tax from the store's default — only for a fresh bill,
  // never overriding a resumed bill's real saved value.
  const storeDefaultExcludeTax = useStoreDefaultExcludeTax();
  useEffect(() => {
    if (resuming || started) return;
    setExcludeTax(storeDefaultExcludeTax);
  }, [storeDefaultExcludeTax, resuming, started]);

  const paymentGatewayAvailable = useStorePaymentGatewayAvailable();
  const [useGateway, setUseGateway] = useState(false);

  async function handlePrimaryAction() {
    if (!useGateway || billType === "credit_bill" || remaining <= 0.01) {
      await createBill();
      return;
    }
    if (busy) return;
    setCreating(true);
    try {
      const billId = savedBillId ?? (await syncCart());
      if (!billId) return;
      const res = await fetch(`/api/bills/${billId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowUnpaidForGateway: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to save the bill.");
        return;
      }
      router.push(`/billing/${billId}/collect`);
    } finally {
      setCreating(false);
    }
  }

  async function loadForResume(id: string) {
    const res = await fetch(`/api/bills/${id}`);
    if (!res.ok) {
      toast.error("Failed to load that bill.");
      setResuming(false);
      return;
    }
    const b = await res.json();
    setBillType(b.billType);
    setTerminalId(b.terminalId);
    setBillStatus(b.status === "held" ? "held" : "draft");
    setSavedBillId(b.id);
    setSavedDocumentNumber(b.documentNumber);
    const loadedBillDate = String(b.billDate).slice(0, 10);
    setBillDate(loadedBillDate);
    setSyncedBillDate(loadedBillDate);
    setExcludeTax(Boolean(b.taxExcluded));
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
    setResuming(false);
  }

  function startBill() {
    if (!terminalId) {
      toast.error("Select a terminal.");
      return;
    }
    rememberTerminalId(terminalId);
    setStarted(true);
  }

  // A remembered terminal skips the Start screen entirely — straight into
  // billing, same as changing financial year doesn't ask again each visit.
  // `started` is already eagerly true from the lazy initializer above in the
  // common case; this effect only has to handle the session resolving after
  // that (confirming it, or demoting a Super Admin session with a stale
  // remembered terminal back to the Start screen).
  useEffect(() => {
    if (resuming || sessionStatus !== "authenticated") return;
    if (!session?.user.storeId) {
      if (started) setStarted(false);
      return;
    }
    if (rememberedTerminalId && !started) {
      setTerminalId(rememberedTerminalId);
      setStarted(true);
    }
  }, [rememberedTerminalId, started, resuming, session?.user.storeId, sessionStatus]);

  const [terminalModalOpen, setTerminalModalOpen] = useState(false);

  // Switches terminal without a page refresh — updates the remembered
  // choice locally, and the saved bill's own row if one already exists.
  async function switchTerminal(newTerminalId: string) {
    setTerminalId(newTerminalId);
    rememberTerminalId(newTerminalId);
    if (savedBillId) {
      const res = await fetch(`/api/bills/${savedBillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalId: newTerminalId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to switch terminal.");
        return;
      }
    }
    toast.success("Terminal switched.");
    setTerminalModalOpen(false);
  }

  async function handleOpenDrawer() {
    const bridge = getPrintBridge();
    if (!bridge.openCashDrawer) {
      toast.error("Cash drawer control is only available in the desktop app.");
      return;
    }
    try {
      await bridge.openCashDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open the cash drawer.");
    }
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
      body: JSON.stringify({ productIds, billId: savedBillId }),
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

  // Purely local — scanning the same product again just increments it.
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

  // Quantity change invalidates any manual split — reverts to automatic.
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

  // Read-only totals preview — nothing here is persisted.
  const previewKey = JSON.stringify({
    billId: savedBillId,
    lines: cartLines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      discountApplied: l.discountApplied,
      allocations: l.manualAllocations ?? undefined,
    })),
    overallDiscount: Number(overallDiscount) || 0,
    customerStateId,
    excludeTax,
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

  // Truly out of stock, vs. a stale override that still resolved fine.
  function isOutOfStock(productId: string): boolean {
    return (
      allocationWarningForLine(productId) !== null && allocationsForLine(productId).length === 0
    );
  }

  // The only place this reaches the server — sends only what changed.
  async function syncCart(): Promise<string | null> {
    if (!billDate) {
      toast.error("Enter a bill date.");
      return null;
    }

    let billId = savedBillId;
    if (!billId) {
      if (!terminalId) {
        toast.error("Select a terminal.");
        return null;
      }
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billType, billDate, terminalId, excludeTax }),
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
      setBillStatus("draft");
      setSyncedBillDate(billDate);
    } else if (billDate !== syncedBillDate) {
      const res = await fetch(`/api/bills/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billDate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to update the bill date.");
        return null;
      }
      setSyncedBillDate(billDate);
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
      if (billId) toast.success(billStatus === "held" ? "Saved." : "Draft saved.");
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
    setExistingPayments([]);
    setPaymentMethodId(null);
    setUseGateway(false);
    setSavedBillId(null);
    setSavedDocumentNumber(null);
    setBillStatus(null);
    setBillDate(new Date().toISOString().slice(0, 10));
    setSyncedBillDate(null);
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

  async function makeDraft() {
    if (!savedBillId) return;
    setMakingDraft(true);
    try {
      const res = await fetch(`/api/bills/${savedBillId}/make-draft`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to make draft.");
        return;
      }
      const updated = (await res.json()) as { documentNumber: string };
      toast.success("Bill is a draft again — stock released.");
      setBillStatus("draft");
      setSavedDocumentNumber(updated.documentNumber);
    } finally {
      setMakingDraft(false);
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

  async function createBill() {
    if (busy) return;
    if (cartLines.length === 0) {
      toast.error("Add items first.");
      return;
    }
    if (remaining > 0.01 && !paymentMethodId && billType !== "credit_bill" && !useGateway) {
      toast.error("Select a payment method.");
      return;
    }
    setCreating(true);
    try {
      const billId = await syncCart();
      if (!billId) return;

      // Re-derive the amount still owed from the server's own bill + payments
      // rather than the client's `remaining` — that value can go stale (e.g.
      // a prior attempt's payment already went through but /complete then
      // failed), and submitting the old amount again would overpay.
      const billRes = await fetch(`/api/bills/${billId}`);
      if (!billRes.ok) {
        toast.error("Failed to load the bill.");
        return;
      }
      const freshBill = (await billRes.json()) as {
        grandTotal: string;
        payments: { amount: string; status: string }[];
      };
      const alreadyPaid = freshBill.payments
        .filter((p) => p.status === "success")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const serverRemaining = Math.max(0, Number(freshBill.grandTotal) - alreadyPaid);

      if (serverRemaining > 0.01 && !paymentMethodId && billType !== "credit_bill" && !useGateway) {
        toast.error("Select a payment method.");
        return;
      }

      if (serverRemaining > 0.01 && paymentMethodId) {
        const res = await fetch(`/api/bills/${billId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId, amount: serverRemaining }),
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

  const totalPaid = existingPayments
    .filter((p) => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, preview.grandTotal - totalPaid);
  const maxOverallDiscount = Math.max(0, preview.subtotal - preview.lineDiscountTotal);
  const customerSummary = selectedCustomerId
    ? (customers.find((c) => c.value === selectedCustomerId)?.label ?? null)
    : customerDraft.name || null;

  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  // Ctrl+S/Ctrl+N need to stay live across every render (cartLines,
  // handlePrimaryAction, etc. are plain values redefined each render) without
  // re-subscribing the listener constantly — a ref holds the latest values,
  // one effect with an empty dep array registers the listener exactly once.
  const shortcutStateRef = useRef({
    started,
    resuming,
    completedBill,
    heldDocumentNumber,
    cartLines,
    discardCart,
    handlePrimaryAction,
  });
  shortcutStateRef.current = {
    started,
    resuming,
    completedBill,
    heldDocumentNumber,
    cartLines,
    discardCart,
    handlePrimaryAction,
  };

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const s = shortcutStateRef.current;
      const onMainScreen = s.started && !s.resuming && !s.completedBill && !s.heldDocumentNumber;

      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (onMainScreen) void s.handlePrimaryAction();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (!onMainScreen) return;
        if (
          s.cartLines.length > 0 &&
          !window.confirm("Discard the current bill and start a new one?")
        ) {
          return;
        }
        s.discardCart();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

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

  if (resuming) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 backdrop-blur-sm">
        <Loader2Icon className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading bill…</p>
      </div>
    );
  }

  if (!started) {
    if (sessionStatus === "loading") {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2Icon className="text-muted-foreground size-8 animate-spin" />
        </div>
      );
    }
    return (
      <div className="space-y-4 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Billing</h1>
          <div className="flex gap-2">
            <Link
              href="/billing/drafts"
              className={buttonVariants({ variant: draftCount > 0 ? "default" : "outline" })}
            >
              Draft bills{draftCount > 0 ? ` (${draftCount})` : ""}
            </Link>
            <Link
              href="/billing/held"
              className={buttonVariants({ variant: heldCount > 0 ? "default" : "outline" })}
            >
              Held bills{heldCount > 0 ? ` (${heldCount})` : ""}
            </Link>
          </div>
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
              <CardTitle className="text-xl">Select a terminal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <p className="text-muted-foreground text-xs">
                  Remembered on this device — asked only once. Bill type and date are set on the
                  billing screen itself.
                </p>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={startBill}>Continue</Button>
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{savedDocumentNumber ?? "New bill"}</h1>
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span>{customerSummary ?? "Walk-in customer"}</span>
            <span>·</span>
            <span>{billType === "credit_bill" ? "Credit Bill" : "Cash Bill"}</span>
            <span>·</span>
            <span>{terminals.find((t) => t.value === terminalId)?.label ?? "No terminal"}</span>
            {terminalId && session?.user.storeId && (
              <ShiftControl terminalId={terminalId} storeId={session.user.storeId} />
            )}
            <button
              type="button"
              data-kbd-item=""
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void handleOpenDrawer()}
            >
              Open Drawer
            </button>
            <Dialog open={terminalModalOpen} onOpenChange={setTerminalModalOpen}>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    data-kbd-item=""
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Switch terminal"
                  />
                }
              >
                <SettingsIcon className="size-5" />
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Switch terminal</DialogTitle>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label>Terminal</Label>
                  <SearchableSelect
                    options={terminals}
                    value={terminalId}
                    onChange={(v) => v && void switchTerminal(v)}
                    placeholder="Select terminal…"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex gap-2">
          {billStatus === "held" ? (
            <>
              <Button variant="outline" data-kbd-item="" onClick={saveDraft} disabled={busy}>
                {savingDraft ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" data-kbd-item="" onClick={makeDraft} disabled={busy}>
                {makingDraft ? "Making draft…" : "Make draft"}
              </Button>
            </>
          ) : (
            <>
              {cartLines.length === 0 && (
                <Button variant="outline" data-kbd-item="" onClick={discardCart} disabled={busy}>
                  {discarding ? "Discarding…" : "Discard"}
                </Button>
              )}
              <Button variant="outline" data-kbd-item="" onClick={saveDraft} disabled={busy}>
                {savingDraft ? "Saving…" : "Save draft"}
              </Button>
              <Button variant="outline" data-kbd-item="" onClick={holdBill} disabled={busy}>
                {holding ? "Holding…" : "Hold"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>
              Bill type
              <RequiredMark />
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                data-kbd-item=""
                variant={billType === "cash_bill" ? "default" : "outline"}
                disabled={!!savedBillId}
                onClick={() => setBillType("cash_bill")}
              >
                Cash Bill
              </Button>
              <Button
                type="button"
                size="sm"
                data-kbd-item=""
                variant={billType === "credit_bill" ? "default" : "outline"}
                disabled={!!savedBillId}
                onClick={() => {
                  setBillType("credit_bill");
                  setUseGateway(false);
                }}
              >
                Credit Bill
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              Bill date
              <RequiredMark />
            </Label>
            <Input
              type="date"
              data-kbd-item=""
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Exclude tax</Label>
            <div className="flex items-center gap-2 pt-1.5">
              <Checkbox
                id="exclude-tax"
                data-kbd-item=""
                checked={excludeTax}
                disabled={!!savedBillId}
                onCheckedChange={(checked) => setExcludeTax(checked === true)}
              />
              <Label htmlFor="exclude-tax" className="font-normal">
                Tax-exempt sale — no GST applied
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

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
              data-kbd-item=""
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  e.stopPropagation();
                  setHighlightedMatch((i) => Math.min(i + 1, productMatches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  e.stopPropagation();
                  setHighlightedMatch((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (productMatches.length > 0) {
                    const target = productMatches[highlightedMatch] ?? productMatches[0];
                    addProduct(target);
                  } else {
                    void searchProducts(scanValue.trim());
                  }
                }
              }}
              placeholder="Scan or search a product…"
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
                    max={line.price * line.quantity}
                    maxMessage={`Can't exceed ${currencySymbol}${money(line.price * line.quantity)}.`}
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
                    data-kbd-item=""
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

      {cartLines.length > 0 && (
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
                    data-kbd-item=""
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(e.target.value)}
                    placeholder="0.00"
                  />
                  {Number(overallDiscount) > maxOverallDiscount && (
                    <div className="text-warning text-xs">
                      Cannot exceed {currencySymbol}
                      {money(maxOverallDiscount)}.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <SearchableSelect
                    data-kbd-item=""
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
              <div className="flex justify-between font-semibold">
                <span>Amount due</span>
                <span>
                  {currencySymbol}
                  {money(remaining)}
                </span>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                data-kbd-item=""
                onClick={() => void handlePrimaryAction()}
                disabled={
                  busy ||
                  cartLines.length === 0 ||
                  (remaining > 0.01 &&
                    !paymentMethodId &&
                    billType !== "credit_bill" &&
                    !useGateway)
                }
              >
                {creating
                  ? "Creating…"
                  : useGateway && remaining > 0.01
                    ? "Proceed to payment"
                    : "Create bill"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentGatewayAvailable && billType !== "credit_bill" && remaining > 0.01 && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="use-gateway"
                    data-kbd-item=""
                    checked={useGateway}
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      setUseGateway(next);
                      if (next) setPaymentMethodId(null);
                    }}
                  />
                  <Label htmlFor="use-gateway" className="text-sm font-normal">
                    Collect via QR / Link / Card — clicking &quot;Proceed to payment&quot; below
                    will save the bill and take you to a payment collection page instead of asking
                    for a method here.
                  </Label>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Method</Label>
                <SearchableSelect
                  data-kbd-item=""
                  options={paymentMethods}
                  value={paymentMethodId}
                  onChange={setPaymentMethodId}
                  placeholder="Select payment method…"
                  disabled={useGateway}
                />
                {billType === "credit_bill" && (
                  <p className="text-muted-foreground text-xs">
                    Optional on a Credit Bill — leave unset to bill fully on credit.
                  </p>
                )}
              </div>

              {existingPayments.length > 0 && (
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!session?.user.storeId && (
        <p className="text-muted-foreground text-sm">
          A Super Admin session has no single store — sign in as a store user to bill.
        </p>
      )}
    </div>
  );
}
