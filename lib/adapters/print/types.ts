export interface ReceiptPrintPayload {
  kind: "receipt";
  storeName: string;
  headerText?: string;
  footerText?: string;
  returnPolicyText?: string;
  documentNumber: string;
  lines: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface LabelPrintItem {
  barcodeValue: string;
  productName: string;
  price: number;
  copies: number;
}

export interface LabelPrintPayload {
  kind: "label";
  labels: LabelPrintItem[];
}

// Store-authored Bill Format HTML (arbitrary layout/CSS, no paper-size field
// on the model) can't be reinterpreted as ESC/POS text the way a structured
// receipt/label payload can — it goes through this variant instead, which a
// real hardware bridge routes through an HTML print pipeline rather than a
// thermal command builder.
export interface HtmlPrintPayload {
  kind: "html";
  html: string;
}

export type PrintPayload = ReceiptPrintPayload | LabelPrintPayload | HtmlPrintPayload;

export type CardChargeStatus = "success" | "failed" | "cancelled" | "unavailable";

export interface CardChargeResult {
  status: CardChargeStatus;
  gatewayReference?: string;
  transactionId?: string;
  message?: string;
}

export interface CardChargeContext {
  requestId: string;
  gatewayReference: string;
  currency: string;
}

export interface HardwareBridge {
  print(payload: PrintPayload): Promise<void>;
  openCashDrawer?(): Promise<void>;
  chargeCard?(amount: number, context: CardChargeContext): Promise<CardChargeResult>;
}

declare global {
  interface Window {
    hardware?: HardwareBridge;
  }
}
