import { jsPDF } from "jspdf";

const MARGIN = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string }
  | { kind: "credentials"; apiKey: string; apiSecret: string };

function buildBlocks(params: { storeName: string; apiKey: string; apiSecret: string }): Block[] {
  return [
    { kind: "h1", text: "E-commerce API Integration Guide" },
    { kind: "p", text: params.storeName },
    { kind: "credentials", apiKey: params.apiKey, apiSecret: params.apiSecret },
    {
      kind: "p",
      text: "Payment is NOT part of this API. How your e-commerce app collects payment is between you and your payment provider — this API only records the resulting order and keeps stock in sync once the order is confirmed/paid.",
    },
    { kind: "h2", text: "Typical order flow" },
    {
      kind: "p",
      text: "1. Populate your catalog from GET /v1/ecommerce/products (and /categories for navigation).",
    },
    {
      kind: "p",
      text: "2. Sign the customer in — customers/request-otp then verify-otp, or customers/login if they've set a password. Guest checkout (no sign-in) is fine too — bills just needs a name/phone.",
    },
    {
      kind: "p",
      text: "3. When checkout starts, call POST /v1/ecommerce/stock-lock once per distinct product in the cart — there's no batch-lock endpoint, so a 3-item cart makes 3 lock calls, each returning its own lockId.",
    },
    {
      kind: "p",
      text: "4. If checkout fails or the cart is abandoned, call DELETE /v1/ecommerce/stock-lock/{id} for each lock you took.",
    },
    {
      kind: "p",
      text: "5. Once payment is confirmed, call POST /v1/ecommerce/bills ONCE with every line together (each carrying its own stockLockId) — this always produces exactly one order, even for a multi-item cart, and releases the locks and permanently deducts stock as part of the same call.",
    },
    {
      kind: "p",
      text: "Locking before billing is recommended but not required — bill creation checks availability itself for any line with no stockLockId. A typical payment-gateway integration (Razorpay, etc.) creates the gateway order right after locking, then calls bills from your server only after your server has verified the gateway's payment signature — never from the browser, and never before verification.",
    },

    { kind: "h2", text: "Multi-store (only if enabled for this credential)" },
    {
      kind: "p",
      text: "Which stores this credential can even use is fixed on the POS side, not by you — your store admin configures it in Settings → E-commerce: a required default billing store, plus an optional set of other stores it may also sell from. This API never creates or changes that set; it only works within it.",
    },
    {
      kind: "p",
      text: "GET /v1/ecommerce/stores lists exactly that pre-configured set (with isDefault marking the admin's chosen default) — use it to let the shopper pick among them, e.g. a pickup location. On stock-lock/bills, storeId is optional: pass one of the ids from that list to bill this particular order under it instead of the default; omit it and the default billing store is used.",
    },
    {
      kind: "p",
      text: "Whichever store results — named or default — is the ONLY store that ever bills the order. Stock itself is a separate concern: if that billing store's own stock falls short and splitting is enabled for this credential, the shortfall is transferred in automatically from another store in the admin-configured set. The customer still only ever sees one bill, from the one store that was resolved.",
    },
    {
      kind: "p",
      text: "Worked example — Store A (billing) has 50 units, Store B (also eligible, splitting on) has 50 — GET /products shows available: 100 combined, with stockByStore showing 50/50. A customer orders 62: Store A's own 50 are used first and fully consumed, then the remaining 12 transfer in from Store B automatically (a real, immediately-accepted Stock Transfer — visible in the POS's own Stock Transfers list, not a fake movement). Store A ends at 0 available, Store B at 38. Exactly one bill is created, billed at Store A, for all 62 units.",
    },

    { kind: "h2", text: "Customer accounts" },
    {
      kind: "p",
      text: "Customers are identified by phone number. A one-time code always works; a password is an optional faster path once set.",
    },

    { kind: "h2", text: "POST /v1/ecommerce/customers/request-otp" },
    {
      kind: "code",
      text: '{ "phone": "9999999999", "email": "jane@example.com", "name": "Jane Doe" }',
    },
    {
      kind: "p",
      text: "Registers the customer on first use. Sends a 6-digit code by SMS (or email if SMS isn't configured). email is only required when SMS delivery isn't configured for this store — omit it otherwise; 400 if there's no way to deliver the code.",
    },

    { kind: "h2", text: "POST /v1/ecommerce/customers/verify-otp" },
    { kind: "code", text: '{ "phone": "9999999999", "code": "123456" }' },
    {
      kind: "code",
      text: '{ "customer": { "id": "…", "name": "…", "phone": "…", "email": "…", "hasPassword": false } }',
    },
    {
      kind: "p",
      text: "id here is the customer's id for every other customer-facing call below — keep it in your own session/cookie.",
    },

    { kind: "h2", text: "POST /v1/ecommerce/customers/login" },
    { kind: "code", text: '{ "phone": "9999999999", "password": "…" }' },

    { kind: "h2", text: "POST /v1/ecommerce/customers/set-password" },
    { kind: "code", text: '{ "customerId": "…", "password": "…" }' },

    { kind: "h2", text: "POST /v1/ecommerce/customers/reset-password" },
    { kind: "code", text: '{ "phone": "9999999999", "code": "123456", "newPassword": "…" }' },
    {
      kind: "p",
      text: '"Forgot password" — request a code, then this in one step. Returns the customer, signed in.',
    },

    { kind: "h2", text: "GET /v1/ecommerce/customers/{customer_id}" },
    { kind: "p", text: "Re-fetch a signed-in customer's profile." },

    { kind: "h2", text: "GET /v1/ecommerce/customers/{customer_id}/orders" },
    {
      kind: "p",
      text: "That customer's order history across every store this credential can sell from.",
    },

    { kind: "h2", text: "Catalog" },
    { kind: "p", text: "GET /v1/ecommerce/categories" },
    { kind: "code", text: '{ "data": [{ "id": "…", "name": "…", "parentCategoryId": null }] }' },

    {
      kind: "p",
      text: "GET /v1/ecommerce/products — params: page, pageSize (max 200), search, categoryId",
    },
    {
      kind: "code",
      text: '{ "data": [{ "id":"…","name":"…","price":199.0,"images":["https://…"],\n  "available":23,"stockByStore":[{"storeId":"…","storeName":"…","available":23}],\n  "tax":{"hsnCode":"…","cgstRate":9,"sgstRate":9,"igstRate":18} }] }',
    },
    {
      kind: "p",
      text: "available is the combined total across every eligible store — that's all a single-store integration, or one that never lets the shopper pick a store, ever needs. stockByStore is the per-store breakdown behind that total; only relevant if your storefront offers a store picker (see Multi-store above) — otherwise ignore it.",
    },
    {
      kind: "p",
      text: "GET /v1/ecommerce/products/{product_id} — full detail: same fields plus description, videos, and categoryId.",
    },
    { kind: "p", text: "GET /v1/ecommerce/products/{product_id}/stock" },
    { kind: "code", text: '{ "productId": "…", "available": 23 }' },

    { kind: "h2", text: "Cart & checkout" },
    { kind: "p", text: "POST /v1/ecommerce/stock-lock" },
    {
      kind: "code",
      text: '{ "productId": "…", "quantity": 2, "externalReference": "cart_abc123" }',
    },
    {
      kind: "code",
      text: '201 → { "lockId": "…", "storeId": "…", "warehouseId": "…", "quantity": 2, "expiresAt": "…" }',
    },
    {
      kind: "p",
      text: "A lock expires 30 minutes after it's taken — if checkout is abandoned and you never call DELETE, the reserved stock becomes available to other customers again automatically once expiresAt passes. Still call DELETE when you know checkout failed or was cancelled; don't rely on the timeout as your primary release path.",
    },

    { kind: "p", text: "DELETE /v1/ecommerce/stock-lock/{id}" },
    { kind: "code", text: '{ "released": true }' },

    { kind: "p", text: "POST /v1/ecommerce/bills" },
    {
      kind: "code",
      text: '{\n  "billDate": "2027-06-01",\n  "customer": {\n    "name":"Jane Doe","phone":"9999999999","email":"jane@example.com",\n    "address":"221B Baker Street","pincode":"400001"\n  },\n  "lines": [\n    { "productId": "…", "quantity": 2, "stockLockId": "…" },\n    { "productId": "…", "quantity": 1, "stockLockId": "…" }\n  ]\n}',
    },
    {
      kind: "p",
      text: "customer is matched by phone, or created. address/pincode are optional free-text shipping details — not validated against any address master, just stored on the order and returned by GET /orders/{id}. lines takes as many products as the cart has, each with its own stockLockId (optional — omit any one to have that line's stock checked at bill time instead of pre-locked); this is the batching point — one call, however many lines, always exactly one bill.",
    },
    { kind: "code", text: '201 → the created bill, status "completed", with all its lines.' },

    {
      kind: "p",
      text: "GET /v1/ecommerce/orders/{order_id} — single order lookup, for a confirmation page or tracking link. Includes customerAddress/customerPincode when they were provided.",
    },

    { kind: "h2", text: "Errors" },
    { kind: "p", text: "401 — missing/invalid X-Api-Key or X-Api-Secret" },
    {
      kind: "p",
      text: "400 — bad input, insufficient stock, a mismatched stockLockId, or a wrong code/password",
    },
    { kind: "p", text: "404 — product/order/customer not found for this credential" },

    { kind: "h2", text: "Refund & cancellation notifications" },
    {
      kind: "p",
      text: "Once an order is created through this API, the customer is notified by email or SMS when a refund against it is issued, and if it's later cancelled. No integration work is needed for this.",
    },
  ];
}

export function downloadIntegrationGuidePdf(params: {
  storeName: string;
  apiKey: string;
  apiSecret: string;
}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function writeLines(lines: string[], lineHeight: number) {
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  }

  for (const block of buildBlocks(params)) {
    if (block.kind === "h1") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      ensureSpace(10);
      doc.text(block.text, MARGIN, y);
      y += 10;
    } else if (block.kind === "h2") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      ensureSpace(12);
      y += 3;
      doc.text(block.text, MARGIN, y);
      y += 7;
    } else if (block.kind === "p") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(block.text, CONTENT_WIDTH);
      writeLines(lines, 5);
      y += 2;
    } else if (block.kind === "code") {
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      const rawLines = block.text
        .split("\n")
        .flatMap((l) => doc.splitTextToSize(l, CONTENT_WIDTH - 4));
      ensureSpace(rawLines.length * 4.5 + 4);
      doc.setFillColor(244, 242, 239);
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, rawLines.length * 4.5 + 4, "F");
      for (const line of rawLines) {
        doc.text(line, MARGIN + 2, y);
        y += 4.5;
      }
      y += 4;
    } else if (block.kind === "credentials") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      ensureSpace(28);
      doc.setFillColor(242, 236, 254);
      doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 26, "F");
      doc.text("Your credentials", MARGIN + 2, y);
      y += 6;
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.text(`X-Api-Key: ${block.apiKey}`, MARGIN + 2, y);
      y += 5;
      doc.text(`X-Api-Secret: ${block.apiSecret}`, MARGIN + 2, y);
      y += 5;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(
        "The secret is shown only once. Store both securely on your server — never client-side.",
        MARGIN + 2,
        y,
      );
      y += 8;
    }
  }

  const filename = `${params.storeName.replace(/[^a-z0-9]+/gi, "-")}-ecommerce-api-guide.pdf`;
  doc.save(filename);
}
