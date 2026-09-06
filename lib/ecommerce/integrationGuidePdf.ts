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
      text: "2. Sign the customer in — customers/request-otp then verify-otp, or customers/login if they've set a password.",
    },
    {
      kind: "p",
      text: "3. When checkout starts, call POST /v1/ecommerce/stock-lock per line to reserve stock.",
    },
    {
      kind: "p",
      text: "4. If checkout fails or the cart is abandoned, call DELETE /v1/ecommerce/stock-lock/{id}.",
    },
    {
      kind: "p",
      text: "5. Once payment is confirmed, call POST /v1/ecommerce/bills — this releases the lock(s) and permanently deducts stock.",
    },
    {
      kind: "p",
      text: "Locking before billing is recommended but not required — bill creation checks availability itself when a line has no stock_lock_id.",
    },

    { kind: "h2", text: "Multi-store (only if enabled for this credential)" },
    {
      kind: "p",
      text: "GET /v1/ecommerce/stores lists every store this credential can sell from. stock-lock and bills both accept an optional storeId — omit it and the credential's own billing store is tried first. An order always produces exactly one bill: if the billing store can't cover it alone and splitting is enabled, the shortfall transfers in from another eligible store automatically.",
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
      text: "Registers the customer on first use. Sends a 6-digit code by SMS (or email if SMS isn't configured).",
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
      text: '{ "data": [{ "id":"…","name":"…","price":199.0,"images":["https://…"],\n  "available":23,"tax":{"hsnCode":"…","cgstRate":9,"sgstRate":9,"igstRate":18} }] }',
    },
    {
      kind: "p",
      text: "GET /v1/ecommerce/products/{product_id} — full detail, plus description and videos.",
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
      text: '201 → { "lockId": "…", "storeId": "…", "warehouseId": "…", "quantity": 2 }',
    },

    { kind: "p", text: "DELETE /v1/ecommerce/stock-lock/{id}" },
    { kind: "code", text: '{ "released": true }' },

    { kind: "p", text: "POST /v1/ecommerce/bills" },
    {
      kind: "code",
      text: '{\n  "billDate": "2027-06-01",\n  "customer": {"name":"Jane Doe","phone":"9999999999","email":"jane@example.com"},\n  "lines": [{ "productId": "…", "quantity": 2, "stockLockId": "…" }]\n}',
    },
    {
      kind: "p",
      text: "customer is matched by phone, or created. stockLockId is optional — omit it to check availability itself.",
    },
    { kind: "code", text: '201 → the created bill, status "completed", with its lines.' },

    {
      kind: "p",
      text: "GET /v1/ecommerce/orders/{order_id} — single order lookup, for a confirmation page or tracking link.",
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
