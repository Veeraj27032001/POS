function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The per-credential setup guide, rendered as a printable HTML page — the
// browser's own print-to-PDF is this app's standard way of producing a
// document (see lib/billing/printing.ts), not a PDF/DOCX library. The API
// secret is left as a token for the caller to substitute client-side, since
// it only ever exists in the browser at the moment of creation.
export function buildIntegrationGuideHtml(params: { storeName: string; apiKey: string }): string {
  const storeName = escapeHtml(params.storeName);
  const apiKey = escapeHtml(params.apiKey);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>E-commerce API Integration Guide — ${storeName}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #1a1523; line-height: 1.5; max-width: 720px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 18px; }
  code, pre { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
  pre { background: #f4f2ef; padding: 10px 12px; border-radius: 6px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
  .credentials-box { background: #f2ecfe; border: 1px solid #d8c8fb; border-radius: 8px; padding: 14px 16px; margin: 16px 0; }
  .credentials-box div { margin: 4px 0; }
  .muted { color: #6b6474; font-size: 12px; }
  @media print { a { color: inherit; text-decoration: none; } }
</style>
</head>
<body>
  <h1>E-commerce API Integration Guide</h1>
  <p class="muted">${storeName}</p>

  <div class="credentials-box">
    <strong>Your credentials</strong>
    <div>X-Api-Key: <code>${apiKey}</code></div>
    <div>X-Api-Secret: <code>{{API_SECRET}}</code></div>
    <div class="muted">The secret is shown only once. Store both securely on your own server — never in client-side code.</div>
  </div>

  <p>Payment is <strong>not</strong> part of this API. How your e-commerce app collects
  payment is between you and your payment provider — this API only records the resulting
  order and keeps stock in sync once the order is confirmed/paid.</p>

  <h2>Typical flow</h2>
  <ol>
    <li>Populate your catalog from <code>GET /v1/ecommerce/products</code>.</li>
    <li>When checkout starts, call <code>POST /v1/ecommerce/stock-lock</code> per line to reserve stock.</li>
    <li>If checkout fails or the cart is abandoned, call <code>DELETE /v1/ecommerce/stock-lock/{id}</code>.</li>
    <li>Once payment is confirmed, call <code>POST /v1/ecommerce/bills</code> — this releases the lock(s) and permanently deducts stock.</li>
  </ol>
  <p class="muted">Locking before billing is recommended but not required — bill creation checks availability itself when a line has no stock_lock_id.</p>

  <h2>Endpoints</h2>

  <h3>GET /v1/ecommerce/products</h3>
  <p>Query params: <code>page</code>, <code>pageSize</code> (max 200, default 50), <code>search</code>.</p>
  <pre>{
  "data": [
    { "id": "…", "name": "…", "price": 199.0, "images": ["https://…"],
      "available": 23, "tax": { "hsnCode": "…", "cgstRate": 9, "sgstRate": 9, "igstRate": 18 } }
  ]
}</pre>

  <h3>GET /v1/ecommerce/products/{product_id}/stock</h3>
  <pre>{ "productId": "…", "available": 23 }</pre>

  <h3>POST /v1/ecommerce/stock-lock</h3>
  <pre>{ "productId": "…", "warehouseId": "…", "quantity": 2, "externalReference": "cart_abc123" }</pre>
  <p class="muted">warehouseId is optional only if your store has exactly one warehouse.</p>
  <pre>201 → { "lockId": "…", "productId": "…", "warehouseId": "…", "quantity": 2 }</pre>

  <h3>DELETE /v1/ecommerce/stock-lock/{id}</h3>
  <pre>{ "released": true }</pre>

  <h3>POST /v1/ecommerce/bills</h3>
  <pre>{
  "billDate": "2027-06-01",
  "customer": { "name": "Jane Doe", "phone": "+919999999999", "email": "jane@example.com" },
  "lines": [{ "productId": "…", "warehouseId": "…", "quantity": 2, "stockLockId": "…" }]
}</pre>
  <p class="muted">customer is matched by phone, or created. stockLockId is optional — omit it to have this call check availability itself.</p>
  <pre>201 → the created bill, status "completed", with its lines.</pre>

  <h2>Errors</h2>
  <table>
    <tr><th>Status</th><th>Meaning</th></tr>
    <tr><td>401</td><td>Missing or invalid X-Api-Key/X-Api-Secret</td></tr>
    <tr><td>400</td><td>Bad input, insufficient stock, or a mismatched stockLockId</td></tr>
    <tr><td>404</td><td>Product/stock lock not found for this credential's store</td></tr>
  </table>

  <h2>Refund &amp; cancellation notifications</h2>
  <p>Once an order is created through this API, the customer is notified by email or SMS
  (whichever contact detail they have on file) when a refund against it is issued, and if it's
  later cancelled. No integration work is needed for this.</p>
</body>
</html>`;
}
