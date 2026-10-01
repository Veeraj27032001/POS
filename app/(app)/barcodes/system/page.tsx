"use client";

import { BarcodeViewDialog } from "@/components/barcode-view-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { focusCurrentNavLink } from "@/lib/keyboard/focusCurrentNavLink";
import { useArrowKeyNav } from "@/lib/keyboard/useArrowKeyNav";
import { useListCount } from "@/lib/pagination/useList";

import { PrintAllButton } from "../print-all-button";
import { PrintLabelButton } from "../print-label-button";

interface SystemBarcodeRow {
  id: string;
  name: string;
  systemBarcode: string;
  price: string;
}

async function fetchAllLabels() {
  const res = await fetch("/api/barcodes/system?pageSize=200");
  const body = (await res.json()) as { data: SystemBarcodeRow[] };
  return body.data.map((row) => ({
    barcodeValue: row.systemBarcode,
    productName: row.name,
    price: Number(row.price),
    copies: 1,
  }));
}

export default function SystemBarcodesPage() {
  const countQuery = useListCount({ resource: "barcodes/system", pageSize: 1 });
  const kbdRef = useArrowKeyNav<HTMLDivElement>({
    selector: "[data-kbd-item]",
    onBoundaryLeft: focusCurrentNavLink,
  });

  return (
    <div ref={kbdRef} className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">System Barcodes</h1>
        <PrintAllButton
          totalCount={countQuery.data?.totalRecords ?? 0}
          fetchLabels={fetchAllLabels}
        />
      </div>

      <DataTable<SystemBarcodeRow>
        resource="barcodes/system"
        getRowId={(row) => row.id}
        searchable
        emptyMessage="No products found."
        columns={[
          { key: "name", header: "Product" },
          {
            key: "barcode",
            header: "Barcode",
            className: "w-48",
            render: (row) => <BarcodeViewDialog value={row.systemBarcode} label={row.name} />,
          },
          {
            key: "systemBarcode",
            header: "System barcode",
            className: "font-mono",
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <PrintLabelButton
                barcodeValue={row.systemBarcode}
                productName={row.name}
                price={Number(row.price)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
