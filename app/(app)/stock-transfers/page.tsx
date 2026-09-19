"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useOptionsList } from "@/lib/masters/useOptionsList";

interface StockTransferRow {
  id: string;
  documentNumber: string;
  storeId: string;
  sourceWarehouseId: string;
  destinationStoreId: string;
  status: string;
  requestedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function StockTransfersPage() {
  const warehouses = useOptionsList("warehouses", "name");
  const stores = useOptionsList("stock-transfers/destination-stores", "name");

  const columns = (kind: "sent" | "incoming") => [
    { key: "documentNumber", header: "Transaction No." },
    {
      key: "sourceWarehouseId",
      header: "Source storage",
      render: (row: StockTransferRow) =>
        warehouses.find((w) => w.value === row.sourceWarehouseId)?.label ?? "—",
    },
    ...(kind === "sent"
      ? [
          {
            key: "destinationStoreId",
            header: "Destination store",
            render: (row: StockTransferRow) =>
              stores.find((s) => s.value === row.destinationStoreId)?.label ?? "—",
          },
        ]
      : [
          {
            key: "storeId",
            header: "From store",
            render: (row: StockTransferRow) =>
              stores.find((s) => s.value === row.storeId)?.label ?? "—",
          },
        ]),
    {
      key: "status",
      header: "Status",
      render: (row: StockTransferRow) => STATUS_LABELS[row.status] ?? row.status,
    },
    {
      key: "requestedAt",
      header: "Date",
      render: (row: StockTransferRow) => formatDateOnly(toDateOnly(row.requestedAt)),
    },
    {
      key: "actions",
      header: "",
      render: (row: StockTransferRow) => (
        <Link
          href={`/stock-transfers/${row.id}`}
          data-kbd-item=""
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          View
        </Link>
      ),
    },
  ];

  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stock Transfer</h1>
        <Link href="/stock-transfers/new" data-kbd-item="" className={buttonVariants()}>
          New Stock Transfer
        </Link>
      </div>

      <Tabs defaultValue="sent">
        <TabsList>
          <TabsTrigger value="sent" data-kbd-item="">
            Send
          </TabsTrigger>
          <TabsTrigger value="incoming" data-kbd-item="">
            Receive
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sent">
          <DataTable<StockTransferRow>
            resource="stock-transfers"
            getRowId={(row) => row.id}
            columns={columns("sent")}
          />
        </TabsContent>
        <TabsContent value="incoming">
          <DataTable<StockTransferRow>
            resource="stock-transfers/incoming"
            getRowId={(row) => row.id}
            columns={columns("incoming")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
