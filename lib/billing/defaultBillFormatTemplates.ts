export const DEFAULT_BILL_TEMPLATE_HTML = `<!doctype html>
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

export const DEFAULT_RECEIPT_TEMPLATE_HTML = `<!doctype html>
<html>
<head>
<style>
  body { font-family: monospace; width: 300px; margin: 0 auto; padding: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  .center { text-align: center; }
  table.items td { padding: 2px 0; }
  table.totals td { padding: 4px 6px; font-weight: bold; border: 1px solid #000; }
  hr { border: none; border-top: 1px dashed #000; }
</style>
</head>
<body>
  <div class="center"><strong>{{storeName}}</strong></div>
  {{#if headerText}}<div class="center">{{headerText}}</div>{{/if}}
  <hr />
  <div>{{documentNumber}}</div>
  <div>{{billDate}}</div>
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
  <hr />
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">{{money subtotal}}</td></tr>
    <tr><td>Discount</td><td style="text-align:right">{{money discountTotal}}</td></tr>
    <tr><td>Tax</td><td style="text-align:right">{{money taxTotal}}</td></tr>
    <tr><td>Total</td><td style="text-align:right">{{money grandTotal}}</td></tr>
  </table>
  {{#if footerText}}<hr /><div class="center">{{footerText}}</div>{{/if}}
  {{#if returnPolicyText}}<div class="center" style="font-size:10px">{{returnPolicyText}}</div>{{/if}}
</body>
</html>`;
