import Handlebars from "handlebars";

Handlebars.registerHelper("money", (value: unknown) => Number(value).toFixed(2));
Handlebars.registerHelper("index1", (index: unknown) => Number(index) + 1);

function renderTemplate(templateHtml: string, data: Record<string, unknown>): string {
  return Handlebars.compile(templateHtml)(data);
}

export interface BillTemplateLine {
  productName: string;
  productBarcode: string;
  productHsnCode?: string | null;
  quantity: number;
  unitPrice: number;
  discountApplied: number;
  lineAmount: number;
  lineTotal: number;
}

export interface BillTemplateData {
  documentNumber: string;
  billType: string;
  billDate: string;
  status: string;
  storeName: string;
  storeAddress?: string | null;
  storeGstin?: string | null;
  storeStateName?: string | null;
  storeStateCode?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  returnPolicyText?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerGstin?: string | null;
  cashierName: string;
  terminalName: string;
  lines: BillTemplateLine[];
  subtotal: number;
  discountTotal: number;
  netSubtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  grandTotal: number;
}

export function renderBillTemplate(templateHtml: string, data: BillTemplateData): string {
  return renderTemplate(templateHtml, data as unknown as Record<string, unknown>);
}

export interface CreditNoteTemplateData {
  documentNumber: string;
  createdAt: string;
  storeName: string;
  storeAddress?: string | null;
  storeGstin?: string | null;
  customerName: string;
  customerPhone: string;
  originalBillDocumentNumber: string;
  reasonLabel: string;
  amount: number;
  taxBreakdown: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    taxAmount: number;
  };
}

export function renderCreditNoteTemplate(
  templateHtml: string,
  data: CreditNoteTemplateData,
): string {
  return renderTemplate(templateHtml, data as unknown as Record<string, unknown>);
}

export interface RefundTemplateData {
  documentNumber: string;
  createdAt: string;
  storeName: string;
  storeAddress?: string | null;
  storeGstin?: string | null;
  originalBillDocumentNumber: string;
  sourceType: string;
  sourceDocumentNumber: string;
  refundMethodName: string;
  status: string;
  amount: number;
}

export function renderRefundTemplate(templateHtml: string, data: RefundTemplateData): string {
  return renderTemplate(templateHtml, data as unknown as Record<string, unknown>);
}
