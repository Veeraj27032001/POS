const SHARED_DOC_STYLE = `
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 32px; }
  .header { text-align: center; padding-bottom: 14px; border-bottom: 3px solid #1e3a8a; margin-bottom: 18px; }
  .header h1 { margin: 0 0 4px; font-size: 21px; color: #1e3a8a; letter-spacing: 0.3px; }
  .header p { margin: 2px 0; color: #666; font-size: 11px; }
  .title { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #1e3a8a; margin: 18px 0; text-transform: uppercase; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.meta td { padding: 4px 0; font-size: 11.5px; vertical-align: top; }
  table.meta td.label { color: #777; width: 90px; }
  table.totals { width: 45%; margin-left: auto; margin-top: 14px; border-collapse: collapse; }
  table.totals td { padding: 4px 6px; font-size: 11.5px; }
  table.totals td.num { text-align: right; }
  table.totals tr.grand td { font-size: 14.5px; font-weight: 700; border-top: 2px solid #1e3a8a; padding-top: 8px; color: #1e3a8a; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9.5px; color: #888; text-align: center; }
`;

export const DEFAULT_BILL_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<style>
${SHARED_DOC_STYLE}
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { background: #eef2ff; color: #1e3a8a; text-align: left; padding: 8px 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #1e3a8a; }
  table.items td { padding: 7px 6px; border-bottom: 1px solid #e5e7eb; font-size: 11.5px; }
  table.items td.num { text-align: right; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{storeName}}</h1>
    {{#if storeAddress}}<p>{{storeAddress}}</p>{{/if}}
    {{#if storeGstin}}<p>GSTIN: {{storeGstin}}</p>{{/if}}
  </div>

  <div class="title">Tax Invoice</div>

  <table class="meta">
    <tr>
      <td class="label">Bill No.</td><td><strong>{{documentNumber}}</strong></td>
      <td class="label">Bill Date</td><td>{{billDate}}</td>
    </tr>
    <tr>
      <td class="label">Customer</td><td>{{#if customerName}}{{customerName}}{{else}}Walk-in{{/if}}</td>
      <td class="label">Phone</td><td>{{customerPhone}}</td>
    </tr>
    <tr>
      <td class="label">Terminal</td><td>{{terminalName}}</td>
      <td class="label">Cashier</td><td>{{cashierName}}</td>
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
    <tr class="grand"><td>Grand Total</td><td class="num">{{money grandTotal}}</td></tr>
  </table>

  <div class="footer">
    {{#if footerText}}<p>{{footerText}}</p>{{/if}}
    {{#if returnPolicyText}}<p>{{returnPolicyText}}</p>{{/if}}
  </div>
</body>
</html>`;

export const DEFAULT_RECEIPT_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; width: 300px; margin: 0 auto; padding: 16px; font-size: 12px; color: #1a1a1a; }
  .center { text-align: center; }
  .store { font-size: 15px; font-weight: 700; color: #1e3a8a; }
  table { width: 100%; border-collapse: collapse; }
  table.items td { padding: 4px 0; border-bottom: 1px dashed #ddd; }
  table.totals td { padding: 3px 0; font-size: 11.5px; }
  table.totals tr.grand td { font-weight: 700; font-size: 13.5px; border-top: 2px solid #1e3a8a; padding-top: 6px; color: #1e3a8a; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
  .footer { margin-top: 12px; font-size: 9.5px; color: #888; text-align: center; }
</style>
</head>
<body>
  <div class="center store">{{storeName}}</div>
  {{#if headerText}}<div class="center">{{headerText}}</div>{{/if}}
  <div class="center">{{documentNumber}} &middot; {{billDate}}</div>
  <hr />
  <table class="items">
    {{#each lines}}
    <tr>
      <td>{{productName}}</td>
      <td style="text-align:right">{{quantity}}</td>
      <td style="text-align:right">{{money unitPrice}}</td>
      <td style="text-align:right">{{money lineTotal}}</td>
    </tr>
    {{/each}}
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">{{money subtotal}}</td></tr>
    <tr><td>Discount</td><td style="text-align:right">{{money discountTotal}}</td></tr>
    <tr><td>Tax</td><td style="text-align:right">{{money taxTotal}}</td></tr>
    <tr class="grand"><td>Total</td><td style="text-align:right">{{money grandTotal}}</td></tr>
  </table>
  <div class="footer">
    {{#if footerText}}<p>{{footerText}}</p>{{/if}}
    {{#if returnPolicyText}}<p>{{returnPolicyText}}</p>{{/if}}
  </div>
</body>
</html>`;

export const DEFAULT_CREDIT_NOTE_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<style>
${SHARED_DOC_STYLE}
</style>
</head>
<body>
  <div class="header">
    <h1>{{storeName}}</h1>
    {{#if storeAddress}}<p>{{storeAddress}}</p>{{/if}}
    {{#if storeGstin}}<p>GSTIN: {{storeGstin}}</p>{{/if}}
  </div>

  <div class="title">Credit Note</div>

  <table class="meta">
    <tr>
      <td class="label">Credit Note No.</td><td><strong>{{documentNumber}}</strong></td>
      <td class="label">Date</td><td>{{createdAt}}</td>
    </tr>
    <tr>
      <td class="label">Customer</td><td>{{customerName}}</td>
      <td class="label">Phone</td><td>{{customerPhone}}</td>
    </tr>
    <tr>
      <td class="label">Against Bill</td><td>{{originalBillDocumentNumber}}</td>
      <td class="label">Reason</td><td>{{reasonLabel}}</td>
    </tr>
  </table>

  <table class="totals">
    <tr><td>Tax</td><td class="num">{{money taxBreakdown.taxAmount}}</td></tr>
    <tr class="grand"><td>Credit Amount</td><td class="num">{{money amount}}</td></tr>
  </table>

  <div class="footer">
    <p>This credit note reduces the amount owed on the bill referenced above.</p>
  </div>
</body>
</html>`;

export const DEFAULT_REFUND_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<style>
${SHARED_DOC_STYLE}
</style>
</head>
<body>
  <div class="header">
    <h1>{{storeName}}</h1>
    {{#if storeAddress}}<p>{{storeAddress}}</p>{{/if}}
    {{#if storeGstin}}<p>GSTIN: {{storeGstin}}</p>{{/if}}
  </div>

  <div class="title">Refund</div>

  <table class="meta">
    <tr>
      <td class="label">Refund No.</td><td><strong>{{documentNumber}}</strong></td>
      <td class="label">Date</td><td>{{createdAt}}</td>
    </tr>
    <tr>
      <td class="label">Against Bill</td><td>{{originalBillDocumentNumber}}</td>
      <td class="label">{{sourceType}}</td><td>{{sourceDocumentNumber}}</td>
    </tr>
    <tr>
      <td class="label">Method</td><td>{{refundMethodName}}</td>
      <td class="label">Status</td><td>{{status}}</td>
    </tr>
  </table>

  <table class="totals">
    <tr class="grand"><td>Refund Amount</td><td class="num">{{money amount}}</td></tr>
  </table>

  <div class="footer">
    <p>Processed against the bill and source document referenced above.</p>
  </div>
</body>
</html>`;
