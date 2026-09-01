import type { BillFormatDesign } from "@/lib/billing/billFormatDesign.types";
import type { BillFormatKind } from "@/generated/prisma/client";

const BILL_DESIGN: BillFormatDesign = {
  version: 1,
  formatKind: "bill",
  blocks: [
    {
      id: "header",
      type: "header",
      config: { showStoreName: true, showAddress: true, showGstin: true, showStateLine: true },
      style: {},
    },
    {
      id: "title",
      type: "title_text",
      config: { text: "Tax Invoice" },
      style: { align: "center" },
    },
    {
      id: "meta",
      type: "meta_grid",
      config: {
        columns: 2,
        rows: [
          { id: "r1", label: "Customer", field: "customerName", visibleIf: "always" },
          { id: "r2", label: "Date", field: "billDate", visibleIf: "always" },
          { id: "r3", label: "GSTIN", field: "customerGstin", visibleIf: "field-truthy" },
          { id: "r4", label: "Invoice No", field: "documentNumber", visibleIf: "always" },
        ],
      },
      style: {},
    },
    {
      id: "items",
      type: "item_table",
      config: {
        columns: [
          { id: "c1", field: "index", headerLabel: "S.No", align: "center", format: "index" },
          {
            id: "c2",
            field: "productName",
            headerLabel: "Description",
            align: "left",
            format: "text",
          },
          {
            id: "c3",
            field: "productHsnCode",
            headerLabel: "HSN Code",
            align: "center",
            format: "text",
          },
          { id: "c4", field: "quantity", headerLabel: "Qty", align: "center", format: "number" },
          { id: "c5", field: "unitPrice", headerLabel: "Rate", align: "right", format: "money" },
          { id: "c6", field: "lineAmount", headerLabel: "Amount", align: "right", format: "money" },
        ],
      },
      style: {},
    },
    {
      id: "totals",
      type: "totals_block",
      config: {
        rows: [
          {
            id: "t1",
            label: "Total Value",
            field: "netSubtotal",
            visibleIf: "always",
            emphasis: false,
          },
          {
            id: "t2",
            label: "Add : CGST",
            field: "cgstAmount",
            visibleIf: "field-truthy",
            emphasis: false,
          },
          {
            id: "t3",
            label: "Add : SGST",
            field: "sgstAmount",
            visibleIf: "field-truthy",
            emphasis: false,
          },
          {
            id: "t4",
            label: "Add : IGST",
            field: "igstAmount",
            visibleIf: "field-truthy",
            emphasis: false,
          },
          {
            id: "t5",
            label: "Grand Total",
            field: "grandTotal",
            visibleIf: "always",
            emphasis: true,
          },
        ],
      },
      style: {},
    },
    {
      id: "sig",
      type: "signature",
      config: { label: "Authorised Signature", showForStoreLine: true, align: "right" },
      style: {},
    },
    {
      id: "footer",
      type: "free_text",
      config: { content: "{{footerText}}\n{{returnPolicyText}}" },
      style: { fontSize: "sm", color: "muted", align: "center" },
    },
  ],
};

const RECEIPT_DESIGN: BillFormatDesign = {
  version: 1,
  formatKind: "receipt",
  blocks: [
    {
      id: "header",
      type: "header",
      config: { showStoreName: true, showAddress: false, showGstin: false, showStateLine: false },
      style: { align: "center" },
    },
    {
      id: "meta",
      type: "meta_grid",
      config: {
        columns: 1,
        rows: [
          { id: "r1", label: "Bill No", field: "documentNumber", visibleIf: "always" },
          { id: "r2", label: "Date", field: "billDate", visibleIf: "always" },
        ],
      },
      style: { align: "center" },
    },
    {
      id: "items",
      type: "item_table",
      config: {
        columns: [
          { id: "c1", field: "productName", headerLabel: "Item", align: "left", format: "text" },
          { id: "c2", field: "quantity", headerLabel: "Qty", align: "right", format: "number" },
          { id: "c3", field: "lineTotal", headerLabel: "Amount", align: "right", format: "money" },
        ],
      },
      style: {},
    },
    {
      id: "totals",
      type: "totals_block",
      config: {
        rows: [
          { id: "t1", label: "Subtotal", field: "subtotal", visibleIf: "always", emphasis: false },
          {
            id: "t2",
            label: "Discount",
            field: "discountTotal",
            visibleIf: "field-truthy",
            emphasis: false,
          },
          { id: "t3", label: "Tax", field: "taxTotal", visibleIf: "field-truthy", emphasis: false },
          { id: "t4", label: "Total", field: "grandTotal", visibleIf: "always", emphasis: true },
        ],
      },
      style: {},
    },
    {
      id: "footer",
      type: "free_text",
      config: { content: "{{footerText}}\n{{returnPolicyText}}" },
      style: { fontSize: "sm", color: "muted", align: "center" },
    },
  ],
};

const CREDIT_NOTE_DESIGN: BillFormatDesign = {
  version: 1,
  formatKind: "credit_note",
  blocks: [
    {
      id: "header",
      type: "header",
      config: { showStoreName: true, showAddress: true, showGstin: true, showStateLine: false },
      style: {},
    },
    {
      id: "title",
      type: "title_text",
      config: { text: "Credit Note" },
      style: { align: "center" },
    },
    {
      id: "meta",
      type: "meta_grid",
      config: {
        columns: 2,
        rows: [
          { id: "r1", label: "Credit Note No.", field: "documentNumber", visibleIf: "always" },
          { id: "r2", label: "Date", field: "createdAt", visibleIf: "always" },
          { id: "r3", label: "Customer", field: "customerName", visibleIf: "always" },
          { id: "r4", label: "Phone", field: "customerPhone", visibleIf: "always" },
          {
            id: "r5",
            label: "Against Bill",
            field: "originalBillDocumentNumber",
            visibleIf: "always",
          },
          { id: "r6", label: "Reason", field: "reasonLabel", visibleIf: "always" },
        ],
      },
      style: {},
    },
    {
      id: "totals",
      type: "totals_block",
      config: {
        rows: [
          {
            id: "t1",
            label: "Tax",
            field: "taxBreakdown.taxAmount",
            visibleIf: "always",
            emphasis: false,
          },
          {
            id: "t2",
            label: "Credit Amount",
            field: "amount",
            visibleIf: "always",
            emphasis: true,
          },
        ],
      },
      style: {},
    },
    {
      id: "footer",
      type: "free_text",
      config: { content: "This credit note reduces the amount owed on the bill referenced above." },
      style: { fontSize: "sm", color: "muted", align: "center" },
    },
  ],
};

const REFUND_DESIGN: BillFormatDesign = {
  version: 1,
  formatKind: "refund",
  blocks: [
    {
      id: "header",
      type: "header",
      config: { showStoreName: true, showAddress: true, showGstin: true, showStateLine: false },
      style: {},
    },
    { id: "title", type: "title_text", config: { text: "Refund" }, style: { align: "center" } },
    {
      id: "meta",
      type: "meta_grid",
      config: {
        columns: 2,
        rows: [
          { id: "r1", label: "Refund No.", field: "documentNumber", visibleIf: "always" },
          { id: "r2", label: "Date", field: "createdAt", visibleIf: "always" },
          {
            id: "r3",
            label: "Against Bill",
            field: "originalBillDocumentNumber",
            visibleIf: "always",
          },
          { id: "r4", label: "Source", field: "sourceDocumentNumber", visibleIf: "always" },
          { id: "r5", label: "Method", field: "refundMethodName", visibleIf: "always" },
          { id: "r6", label: "Status", field: "status", visibleIf: "always" },
        ],
      },
      style: {},
    },
    {
      id: "totals",
      type: "totals_block",
      config: {
        rows: [
          {
            id: "t1",
            label: "Refund Amount",
            field: "amount",
            visibleIf: "always",
            emphasis: true,
          },
        ],
      },
      style: {},
    },
    {
      id: "footer",
      type: "free_text",
      config: { content: "Processed against the bill and source document referenced above." },
      style: { fontSize: "sm", color: "muted", align: "center" },
    },
  ],
};

export const DEFAULT_BILL_FORMAT_DESIGNS: Record<BillFormatKind, BillFormatDesign> = {
  bill: BILL_DESIGN,
  receipt: RECEIPT_DESIGN,
  credit_note: CREDIT_NOTE_DESIGN,
  refund: REFUND_DESIGN,
};
