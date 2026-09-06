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
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #1a1523; line-height: 1.5; max-width: 760px; margin: 32px auto; padding: 0 24px; }
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

  <h2>Typical order flow</h2>
  <ol>
    <li>Populate your catalog from <code>GET /v1/ecommerce/products</code> (and <code>/categories</code> for navigation).</li>
    <li>Sign the customer in — <code>customers/request-otp</code> then <code>verify-otp</code>, or <code>customers/login</code> if they've set a password.</li>
    <li>When checkout starts, call <code>POST /v1/ecommerce/stock-lock</code> per line to reserve stock.</li>
    <li>If checkout fails or the cart is abandoned, call <code>DELETE /v1/ecommerce/stock-lock/{id}</code>.</li>
    <li>Once payment is confirmed, call <code>POST /v1/ecommerce/bills</code> — this releases the lock(s) and permanently deducts stock.</li>
  </ol>
  <p class="muted">Locking before billing is recommended but not required — bill creation checks availability itself when a line has no stock_lock_id.</p>

  <h2>Multi-store (only if enabled for this credential)</h2>
  <p>If this credential is set up to sell from more than one store, <code>GET /v1/ecommerce/stores</code>
  lists every eligible store. <code>stock-lock</code> and <code>bills</code> both accept an optional
  <code>storeId</code> — omit it and the credential's own default store is tried first. An order
  always produces exactly <strong>one</strong> bill: if the preferred store can't cover it alone and
  splitting is enabled, the shortfall is transferred in from another eligible store automatically —
  you never need to handle a multi-bill order.</p>

  <h2>Customer accounts</h2>
  <p>Customers are identified by phone number. There's no password required — phone + a one-time
  code always works; a password is an optional faster path once set.</p>

  <h3>POST /v1/ecommerce/customers/request-otp</h3>
  <pre>{ "phone": "9999999999", "email": "jane@example.com", "name": "Jane Doe" }</pre>
  <p class="muted">Registers the customer on first use. Sends a 6-digit code by SMS (or email if SMS isn't configured for this store).</p>
  <pre>{ "sent": true }</pre>

  <h3>POST /v1/ecommerce/customers/verify-otp</h3>
  <pre>{ "phone": "9999999999", "code": "123456" }</pre>
  <pre>{ "customer": { "id": "…", "name": "…", "phone": "…", "email": "…", "hasPassword": false } }</pre>
  <p class="muted"><code>id</code> here is the customer's id for every other customer-facing call below — keep it in your own session/cookie.</p>

  <h3>POST /v1/ecommerce/customers/login</h3>
  <pre>{ "phone": "9999999999", "password": "…" }</pre>
  <p class="muted">Only works once the customer has set a password via set-password. Returns the same customer shape as verify-otp.</p>

  <h3>POST /v1/ecommerce/customers/set-password</h3>
  <pre>{ "customerId": "…", "password": "…" }</pre>
  <p class="muted">Call once the customer is already signed in (via verify-otp or an existing password).</p>

  <h3>POST /v1/ecommerce/customers/reset-password</h3>
  <pre>{ "phone": "9999999999", "code": "123456", "newPassword": "…" }</pre>
  <p class="muted">"Forgot password" — request a code via request-otp, then this in one step. Returns the customer, signed in.</p>

  <h3>GET /v1/ecommerce/customers/{customer_id}</h3>
  <p class="muted">Re-fetch a signed-in customer's profile (e.g. after a page refresh).</p>

  <h3>GET /v1/ecommerce/customers/{customer_id}/orders</h3>
  <p class="muted">That customer's order history across every store this credential can sell from.</p>

  <h2>Catalog</h2>

  <h3>GET /v1/ecommerce/categories</h3>
  <pre>{ "data": [{ "id": "…", "name": "…", "parentCategoryId": null }] }</pre>

  <h3>GET /v1/ecommerce/products</h3>
  <p>Query params: <code>page</code>, <code>pageSize</code> (max 200, default 50), <code>search</code>, <code>categoryId</code>.</p>
  <pre>{
  "data": [
    { "id": "…", "name": "…", "price": 199.0, "images": ["https://…"],
      "available": 23, "tax": { "hsnCode": "…", "cgstRate": 9, "sgstRate": 9, "igstRate": 18 } }
  ]
}</pre>

  <h3>GET /v1/ecommerce/products/{product_id}</h3>
  <p class="muted">Full detail for one product — same fields as the list, plus <code>description</code> and <code>videos</code>.</p>

  <h3>GET /v1/ecommerce/products/{product_id}/stock</h3>
  <pre>{ "productId": "…", "available": 23 }</pre>

  <h2>Cart &amp; checkout</h2>

  <h3>POST /v1/ecommerce/stock-lock</h3>
  <pre>{ "productId": "…", "quantity": 2, "externalReference": "cart_abc123" }</pre>
  <pre>201 → { "lockId": "…", "storeId": "…", "warehouseId": "…", "quantity": 2 }</pre>

  <h3>DELETE /v1/ecommerce/stock-lock/{id}</h3>
  <pre>{ "released": true }</pre>

  <h3>POST /v1/ecommerce/bills</h3>
  <pre>{
  "billDate": "2027-06-01",
  "customer": { "name": "Jane Doe", "phone": "9999999999", "email": "jane@example.com" },
  "lines": [{ "productId": "…", "quantity": 2, "stockLockId": "…" }]
}</pre>
  <p class="muted">customer is matched by phone, or created. stockLockId is optional — omit it to have this call check availability itself.</p>
  <pre>201 → the created bill, status "completed", with its lines.</pre>

  <h3>GET /v1/ecommerce/orders/{order_id}</h3>
  <p class="muted">Single order lookup — order confirmation page or tracking link.</p>

  <h2>Errors</h2>
  <table>
    <tr><th>Status</th><th>Meaning</th></tr>
    <tr><td>401</td><td>Missing or invalid X-Api-Key/X-Api-Secret</td></tr>
    <tr><td>400</td><td>Bad input, insufficient stock, a mismatched stockLockId, or a wrong code/password</td></tr>
    <tr><td>404</td><td>Product/order/customer not found for this credential</td></tr>
  </table>

  <h2>Refund &amp; cancellation notifications</h2>
  <p>Once an order is created through this API, the customer is notified by email or SMS
  (whichever contact detail they have on file) when a refund against it is issued, and if it's
  later cancelled. No integration work is needed for this.</p>
</body>
</html>`;
}
