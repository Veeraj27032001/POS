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

export type PrintPayload = ReceiptPrintPayload | LabelPrintPayload;

export interface HardwareBridge {
  print(payload: PrintPayload): Promise<void>;
  openCashDrawer?(): Promise<void>;
}

declare global {
  interface Window {
    hardware?: HardwareBridge;
  }
}
