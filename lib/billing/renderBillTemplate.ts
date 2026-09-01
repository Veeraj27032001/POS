import Handlebars from "handlebars";

Handlebars.registerHelper("money", (value: unknown) => Number(value).toFixed(2));
Handlebars.registerHelper("index1", (index: unknown) => Number(index) + 1);

export interface BillTemplateLine {
  productName: string;
  productBarcode: string;
  quantity: number;
  unitPrice: number;
  discountApplied: number;
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
  headerText?: string | null;
  footerText?: string | null;
  returnPolicyText?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  cashierName: string;
  terminalName: string;
  lines: BillTemplateLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function renderBillTemplate(templateHtml: string, data: BillTemplateData): string {
  return Handlebars.compile(templateHtml)(data);
}
