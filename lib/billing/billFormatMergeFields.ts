import type { BillFormatKind } from "@/generated/prisma/client";

export interface MergeFieldOption {
  field: string;
  label: string;
}

const BILL_SCALAR_FIELDS: MergeFieldOption[] = [
  { field: "documentNumber", label: "Document Number" },
  { field: "billType", label: "Bill Type" },
  { field: "billDate", label: "Bill Date" },
  { field: "status", label: "Status" },
  { field: "storeName", label: "Store Name" },
  { field: "storeAddress", label: "Store Address" },
  { field: "storeGstin", label: "Store GSTIN" },
  { field: "storeStateName", label: "Store State" },
  { field: "storeStateCode", label: "Store State Code" },
  { field: "headerText", label: "Header Text" },
  { field: "footerText", label: "Footer Text" },
  { field: "returnPolicyText", label: "Return Policy Text" },
  { field: "customerName", label: "Customer Name" },
  { field: "customerPhone", label: "Customer Phone" },
  { field: "customerAddress", label: "Customer Address" },
  { field: "customerGstin", label: "Customer GSTIN" },
  { field: "cashierName", label: "Cashier Name" },
  { field: "terminalName", label: "Terminal Name" },
];

const BILL_LINE_FIELDS: MergeFieldOption[] = [
  { field: "productName", label: "Product Name" },
  { field: "productBarcode", label: "Product Barcode" },
  { field: "productHsnCode", label: "HSN Code" },
  { field: "quantity", label: "Quantity" },
  { field: "unitPrice", label: "Unit Price" },
  { field: "discountApplied", label: "Discount Applied" },
  { field: "lineAmount", label: "Line Amount" },
  { field: "lineTotal", label: "Line Total" },
];

const BILL_SUMMARY_FIELDS: MergeFieldOption[] = [
  { field: "subtotal", label: "Subtotal" },
  { field: "discountTotal", label: "Discount Total" },
  { field: "netSubtotal", label: "Net Subtotal" },
  { field: "cgstAmount", label: "CGST Amount" },
  { field: "sgstAmount", label: "SGST Amount" },
  { field: "igstAmount", label: "IGST Amount" },
  { field: "taxTotal", label: "Tax Total" },
  { field: "grandTotal", label: "Grand Total" },
];

const CREDIT_NOTE_SCALAR_FIELDS: MergeFieldOption[] = [
  { field: "documentNumber", label: "Document Number" },
  { field: "createdAt", label: "Date" },
  { field: "storeName", label: "Store Name" },
  { field: "storeAddress", label: "Store Address" },
  { field: "storeGstin", label: "Store GSTIN" },
  { field: "customerName", label: "Customer Name" },
  { field: "customerPhone", label: "Customer Phone" },
  { field: "originalBillDocumentNumber", label: "Original Bill Number" },
  { field: "reasonLabel", label: "Reason" },
];

const CREDIT_NOTE_SUMMARY_FIELDS: MergeFieldOption[] = [
  { field: "amount", label: "Amount" },
  { field: "taxBreakdown.cgstAmount", label: "CGST Amount" },
  { field: "taxBreakdown.sgstAmount", label: "SGST Amount" },
  { field: "taxBreakdown.igstAmount", label: "IGST Amount" },
  { field: "taxBreakdown.taxAmount", label: "Tax Amount" },
];

const REFUND_SCALAR_FIELDS: MergeFieldOption[] = [
  { field: "documentNumber", label: "Document Number" },
  { field: "createdAt", label: "Date" },
  { field: "storeName", label: "Store Name" },
  { field: "storeAddress", label: "Store Address" },
  { field: "storeGstin", label: "Store GSTIN" },
  { field: "originalBillDocumentNumber", label: "Original Bill Number" },
  { field: "sourceType", label: "Source Type" },
  { field: "sourceDocumentNumber", label: "Source Document Number" },
  { field: "refundMethodName", label: "Refund Method" },
  { field: "status", label: "Status" },
];

const REFUND_SUMMARY_FIELDS: MergeFieldOption[] = [{ field: "amount", label: "Amount" }];

const LOGO_FIELD: MergeFieldOption = { field: "storeLogoUrl", label: "Store Logo" };

export function getScalarFields(formatKind: BillFormatKind): MergeFieldOption[] {
  if (formatKind === "credit_note") return [...CREDIT_NOTE_SCALAR_FIELDS, LOGO_FIELD];
  if (formatKind === "refund") return [...REFUND_SCALAR_FIELDS, LOGO_FIELD];
  return [...BILL_SCALAR_FIELDS, LOGO_FIELD];
}

export function getLineFields(formatKind: BillFormatKind): MergeFieldOption[] {
  if (formatKind === "credit_note" || formatKind === "refund") return [];
  return BILL_LINE_FIELDS;
}

export function getSummaryFields(formatKind: BillFormatKind): MergeFieldOption[] {
  if (formatKind === "credit_note") return CREDIT_NOTE_SUMMARY_FIELDS;
  if (formatKind === "refund") return REFUND_SUMMARY_FIELDS;
  return BILL_SUMMARY_FIELDS;
}
