"use client";

import { useState } from "react";
import type { z } from "zod";

import { ResourcePage } from "@/components/resource-form/resource-page";
import { StoreCardFilter } from "@/components/store-card-filter";
import { billFormatCreateSchema, billFormatUpdateSchema } from "@/lib/masters/schemas";
import { formatDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";

interface BillFormatRow {
  id: string;
  billType: string;
  name: string;
  effectiveFrom: string;
  isDefault: boolean;
  isActive: boolean;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  cash_bill: "Cash Bill",
  credit_bill: "Credit Bill",
  online_bill: "Online Bill",
};

const STARTER_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header p { margin: 2px 0; }
  .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 12px 0; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.meta td { padding: 2px 0; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th, table.items td { border: 1px solid #333; padding: 4px 6px; font-size: 11px; }
  table.items th { background: #eee; text-align: left; }
  table.items td.num { text-align: right; }
  table.totals { width: 40%; margin-left: auto; border-collapse: collapse; margin-top: 8px; }
  table.totals td { padding: 2px 6px; }
  table.totals td.num { text-align: right; }
  .footer { margin-top: 24px; font-size: 10px; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{storeName}}</h1>
    {{#if storeAddress}}<p>{{storeAddress}}</p>{{/if}}
    {{#if storeGstin}}<p>GSTIN: {{storeGstin}}</p>{{/if}}
  </div>

  <div class="title">TAX INVOICE</div>

  <table class="meta">
    <tr>
      <td><strong>Bill No:</strong> {{documentNumber}}</td>
      <td><strong>Bill Date:</strong> {{billDate}}</td>
    </tr>
    <tr>
      <td><strong>Customer:</strong> {{#if customerName}}{{customerName}}{{else}}Walk-in{{/if}}</td>
      <td><strong>Phone:</strong> {{customerPhone}}</td>
    </tr>
    <tr>
      <td><strong>Terminal:</strong> {{terminalName}}</td>
      <td><strong>Cashier:</strong> {{cashierName}}</td>
    </tr>
  </table>

  <table class="items">
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th>Barcode</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Discount</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td>{{index1 @index}}</td>
        <td>{{productName}}</td>
        <td>{{productBarcode}}</td>
        <td class="num">{{quantity}}</td>
        <td class="num">{{money unitPrice}}</td>
        <td class="num">{{money discountApplied}}</td>
        <td class="num">{{money lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="num">{{money subtotal}}</td></tr>
    <tr><td>Discount</td><td class="num">{{money discountTotal}}</td></tr>
    <tr><td>Tax</td><td class="num">{{money taxTotal}}</td></tr>
    <tr><td><strong>Grand Total</strong></td><td class="num"><strong>{{money grandTotal}}</strong></td></tr>
  </table>

  <div class="footer">
    {{#if footerText}}<p>{{footerText}}</p>{{/if}}
    {{#if returnPolicyText}}<p>{{returnPolicyText}}</p>{{/if}}
  </div>
</body>
</html>`;

export default function BillFormatsPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  return (
    <div>
      <div className="px-8 pt-8">
        <StoreCardFilter value={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {selectedStoreId && (
        <ResourcePage<
          BillFormatRow,
          z.infer<typeof billFormatCreateSchema>,
          z.infer<typeof billFormatUpdateSchema>
        >
          resource="bill-formats"
          title="Bill Formats"
          searchable
          columns={[
            {
              key: "billType",
              header: "Bill type",
              render: (row) => BILL_TYPE_LABELS[row.billType] ?? row.billType,
            },
            { key: "name", header: "Name" },
            {
              key: "effectiveFrom",
              header: "Effective from",
              render: (row) => formatDateOnly(toDateOnly(row.effectiveFrom)),
            },
            {
              key: "isDefault",
              header: "Default",
              render: (row) => (row.isDefault ? "Yes" : "No"),
            },
            { key: "isActive", header: "Active", render: (row) => (row.isActive ? "Yes" : "No") },
          ]}
          fields={[
            {
              name: "billType",
              label: "Bill type",
              type: "select",
              placeholder: "Select bill type…",
              options: [
                { value: "cash_bill", label: "Cash Bill" },
                { value: "credit_bill", label: "Credit Bill" },
                { value: "online_bill", label: "Online Bill" },
              ],
            },
            { name: "name", label: "Name", type: "text" },
            { name: "effectiveFrom", label: "Effective from", type: "date" },
            {
              name: "templateHtml",
              label: "Template HTML",
              type: "textarea",
              placeholder:
                "<html>…{{documentNumber}}, {{grandTotal}}, {{#each lines}}{{productName}}{{/each}}…</html>",
            },
            { name: "isDefault", label: "Default for this store", type: "boolean" },
          ]}
          createSchema={billFormatCreateSchema}
          updateSchema={billFormatUpdateSchema}
          getRowId={(row) => row.id}
          filters={{ storeId: selectedStoreId }}
          createDefaultValues={{ storeId: selectedStoreId, templateHtml: STARTER_TEMPLATE_HTML }}
        />
      )}
    </div>
  );
}
