import JsBarcode from "jsbarcode";

import type { HardwareBridge, PrintPayload } from "./types";

function renderBarcodeSvg(value: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, { height: 40, fontSize: 12, margin: 0 });
  return svg.outerHTML;
}

function renderReceiptHtml(p: Extract<PrintPayload, { kind: "receipt" }>): string {
  const rows = p.lines
    .map(
      (l) =>
        `<tr><td>${l.name}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${l.unitPrice.toFixed(2)}</td><td style="text-align:right">${l.lineTotal.toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><title>${p.documentNumber}</title>
    <style>
      body { font-family: monospace; width: 300px; margin: 0 auto; padding: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .center { text-align: center; }
      .totals td { padding-top: 4px; font-weight: bold; }
      hr { border: none; border-top: 1px dashed #000; }
    </style></head>
    <body>
      <div class="center"><strong>${p.storeName}</strong></div>
      ${p.headerText ? `<div class="center">${p.headerText}</div>` : ""}
      <hr />
      <div>${p.documentNumber}</div>
      <table>${rows}</table>
      <hr />
      <table class="totals">
        <tr><td>Subtotal</td><td style="text-align:right">${p.subtotal.toFixed(2)}</td></tr>
        <tr><td>Discount</td><td style="text-align:right">${p.discountTotal.toFixed(2)}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">${p.taxTotal.toFixed(2)}</td></tr>
        <tr><td>Total</td><td style="text-align:right">${p.grandTotal.toFixed(2)}</td></tr>
      </table>
      ${p.footerText ? `<hr /><div class="center">${p.footerText}</div>` : ""}
      ${p.returnPolicyText ? `<div class="center" style="font-size:10px">${p.returnPolicyText}</div>` : ""}
      <script>window.onload = () => window.print();</script>
    </body></html>`;
}

function renderLabelHtml(p: Extract<PrintPayload, { kind: "label" }>): string {
  const labels = p.labels
    .flatMap((item) => {
      const barcodeSvg = renderBarcodeSvg(item.barcodeValue);
      return Array.from(
        { length: item.copies },
        () =>
          `<div class="label">
            <div class="barcode">${barcodeSvg}</div>
            <div class="name">${item.productName}</div>
            <div class="price">₹${item.price.toFixed(2)}</div>
          </div>`,
      );
    })
    .join("");
  return `<!doctype html><html><head><title>Labels</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: sans-serif; font-size: 11px; margin: 0; padding: 8px; }
      .labels { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; }
      .label {
        width: 180px;
        overflow: hidden;
        text-align: center;
        padding: 6px;
        border: 1px dashed #ccc;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .label .barcode { width: 100%; overflow: hidden; }
      .label .barcode svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
      .label .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .label .price { font-weight: bold; }
    </style></head>
    <body>
      <div class="labels">${labels}</div>
      <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
    </body></html>`;
}

export const browserPrintBridge: HardwareBridge = {
  async print(payload: PrintPayload) {
    const html = payload.kind === "receipt" ? renderReceiptHtml(payload) : renderLabelHtml(payload);
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) throw new Error("Print window was blocked by the browser's popup blocker.");
    win.document.write(html);
    win.document.close();
  },
};
