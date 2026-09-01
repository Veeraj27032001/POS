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
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; margin: 32px; }
  .topbar { display: flex; justify-content: space-between; align-items: flex-start; }
  .topbar h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #6d4aa0; }
  .gst-line { font-weight: 700; color: #6d4aa0; font-size: 12.5px; margin-bottom: 6px; }
  .ribbon { background: #7b5ea6; color: #fff; font-weight: 600; font-size: 14px; padding: 8px 22px; border-radius: 6px; white-space: nowrap; }
  .addr-line { font-weight: 700; font-size: 11.5px; margin: 2px 0; }
  .divider-bar { height: 8px; background: #c3b3e0; margin: 14px 0 16px; }
  table.info-box { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 16px; }
  table.info-box td { padding: 10px 14px; font-size: 11.5px; vertical-align: top; }
  table.info-box td.right { text-align: right; }
  table.items { width: 100%; border-collapse: collapse; border: 2px solid #000; }
  table.items th { background: #c3b3e0; text-align: left; padding: 8px 8px; font-size: 11px; font-weight: 700; border: 1px solid #000; }
  table.items td { padding: 7px 8px; font-size: 11.5px; border: 1px solid #000; }
  table.items td.c { text-align: center; }
  table.items td.num { text-align: right; }
  table.items tfoot td { font-weight: 700; }
  table.items tr.total-value td, table.items tr.grand-total td { background: #c3b3e0; }
  .words { margin-top: 20px; font-size: 11.5px; }
  .signature { margin-top: 48px; text-align: right; font-size: 11.5px; }
  .sig-space { height: 40px; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9.5px; color: #888; text-align: center; }
</style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1>{{storeName}}</h1>
      {{#if storeGstin}}<div class="gst-line">GST No. {{storeGstin}}</div>{{/if}}
    </div>
    <div class="ribbon">Tax Invoice</div>
  </div>
  {{#if storeAddress}}<div class="addr-line">{{storeAddress}}</div>{{/if}}
  {{#if storeStateName}}<div class="addr-line">State Name : {{storeStateName}}{{#if storeStateCode}}, State Code : {{storeStateCode}}{{/if}}</div>{{/if}}

  <div class="divider-bar"></div>

  <table class="info-box">
    <tr>
      <td>
        <div><strong>Client Name :</strong> {{#if customerName}}{{customerName}}{{else}}Walk-in{{/if}}</div>
        {{#if customerAddress}}<div><strong>Address</strong> : {{customerAddress}}</div>{{/if}}
        {{#if customerGstin}}<div><strong>GSTIN</strong> : {{customerGstin}}</div>{{/if}}
      </td>
      <td class="right">
        <div><strong>Date</strong> : {{billDate}}</div>
        <div><strong>Invoice No</strong> : {{documentNumber}}</div>
      </td>
    </tr>
  </table>

  <table class="items">
    <thead>
      <tr>
        <th>S.No</th>
        <th>Description</th>
        <th>HSN Code</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="c">{{index1 @index}}</td>
        <td>{{productName}}</td>
        <td class="c">{{productHsnCode}}</td>
        <td class="c">{{quantity}}</td>
        <td class="num">{{money unitPrice}}</td>
        <td class="num">{{money lineAmount}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr class="total-value"><td colspan="5">Total Value</td><td class="num">{{money netSubtotal}}</td></tr>
      {{#if cgstAmount}}<tr><td colspan="4"></td><td>Add : CGST</td><td class="num">{{money cgstAmount}}</td></tr>{{/if}}
      {{#if sgstAmount}}<tr><td colspan="4"></td><td>Add : SGST</td><td class="num">{{money sgstAmount}}</td></tr>{{/if}}
      {{#if igstAmount}}<tr><td colspan="4"></td><td>Add : IGST</td><td class="num">{{money igstAmount}}</td></tr>{{/if}}
      <tr class="grand-total"><td colspan="5">Grand Total</td><td class="num">{{money grandTotal}}</td></tr>
    </tfoot>
  </table>

  <div class="words">Amount in Words: ________________________________</div>

  <div class="signature">
    <div>For {{storeName}}</div>
    <div class="sig-space"></div>
    <div>Authorised Signature</div>
  </div>

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
