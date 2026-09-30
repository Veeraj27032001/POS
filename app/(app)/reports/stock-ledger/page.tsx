"use client";

import { useEffect, useState } from "react";

import { LoadingState } from "@/components/loading-state";
import { SearchableSelect } from "@/components/searchable-select";
import { StoreCardFilter } from "@/components/store-card-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDatePart } from "@/lib/datetime/format";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface FinancialYearOption {
  id: string;
  label: string;
}

interface StockLedgerRow {
  date: string;
  docType: string;
  docNumber: string;
  qtyIn: number;
  qtyOut: number;
  runningBalance: number;
}

interface StockLedgerResponse {
  financialYearLabel: string;
  warehouseName: string;
  productName: string;
  openingBalance: number;
  closingBalance: number;
  rows: StockLedgerRow[];
}

export default function StockLedgerReportPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [financialYears, setFinancialYears] = useState<FinancialYearOption[]>([]);
  useEffect(() => {
    fetch("/api/financial-years")
      .then((res) => res.json())
      .then((json: { financialYears: FinancialYearOption[] }) =>
        setFinancialYears(json.financialYears),
      )
      .catch(() => setFinancialYears([]));
  }, []);
  const warehouses = useOptionsList(
    selectedStoreId ? "warehouses" : "",
    "name",
    selectedStoreId ? `storeId=${selectedStoreId}` : undefined,
  );
  const products = useOptionsList("products", "name");

  const [financialYearId, setFinancialYearId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  const [result, setResult] = useState<StockLedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  useEffect(() => {
    if (!financialYearId || !warehouseId || !productId) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/reports/stock-ledger?financialYearId=${financialYearId}&warehouseId=${warehouseId}&productId=${productId}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Failed to load the stock ledger.");
        }
        return res.json();
      })
      .then((data: StockLedgerResponse) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [financialYearId, warehouseId, productId]);

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Stock Ledger</h1>
        <p className="text-muted-foreground text-sm">
          Opening balance, every movement, and closing balance for one product at one storage
          location across a financial year.
        </p>
      </div>

      <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />

      {selectedStoreId && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1.5">
            <SearchableSelect
              data-kbd-item=""
              options={financialYears.map((fy) => ({ value: fy.id, label: fy.label }))}
              value={financialYearId}
              onChange={setFinancialYearId}
              placeholder="Financial year"
            />
          </div>
          <div className="w-56 space-y-1.5">
            <SearchableSelect
              data-kbd-item=""
              options={warehouses}
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="Storage"
            />
          </div>
          <div className="w-64 space-y-1.5">
            <SearchableSelect
              data-kbd-item=""
              options={products}
              value={productId}
              onChange={setProductId}
              placeholder="Product"
            />
          </div>
        </div>
      )}

      {loading && <LoadingState />}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {result && !loading && (
        <>
          <dl className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-3">
            {[
              ["Product", result.productName],
              ["Storage", result.warehouseName],
              ["Financial Year", result.financialYearLabel],
              ["Opening Balance", String(result.openingBalance)],
              ["Closing Balance", String(result.closingBalance)],
              ["Movements", String(result.rows.length)],
            ].map(([label, value]) => (
              <div key={label} className="bg-card flex flex-col gap-1 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Document Number</TableHead>
                  <TableHead>Qty In</TableHead>
                  <TableHead>Qty Out</TableHead>
                  <TableHead>Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Opening balance
                  </TableCell>
                  <TableCell className="font-medium">{result.openingBalance}</TableCell>
                </TableRow>
                {result.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No movements in this financial year.
                    </TableCell>
                  </TableRow>
                )}
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDatePart(row.date)}</TableCell>
                    <TableCell>{row.docType}</TableCell>
                    <TableCell>{row.docNumber}</TableCell>
                    <TableCell>{row.qtyIn > 0 ? row.qtyIn : "—"}</TableCell>
                    <TableCell>{row.qtyOut > 0 ? row.qtyOut : "—"}</TableCell>
                    <TableCell className="font-medium">{row.runningBalance}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground font-medium">
                    Closing balance
                  </TableCell>
                  <TableCell className="font-semibold">{result.closingBalance}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
