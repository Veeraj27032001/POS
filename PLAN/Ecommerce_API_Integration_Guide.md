# E-Commerce Integration Guide

Connect your own online store to this POS so stock and orders stay in sync automatically. This guide is for the developer setting up that connection.

---

## 1. Getting Your Credentials

1. In the POS admin, go to **Settings → E-Commerce**.
2. Click **Generate New Credential**, give it a label (e.g. "My Shopify Store").
3. You'll be shown an `api_key` and `api_secret` **once** — copy both immediately. The secret is never shown again; if you lose it, revoke the credential and generate a new one.

Credentials are scoped to a single store. If you operate more than one store on this POS, generate a separate credential for each.

## 2. Authentication

Every request includes your credentials in the request headers:

```
X-API-Key: your_api_key
X-API-Secret: your_api_secret
```

All requests are HTTPS only. A request with an invalid, revoked, or missing credential returns `401 Unauthorized`.

## 3. The Typical Flow

Most integrations follow the same three steps, in order:

1. **Show your catalog** — pull products and live stock with `GET /v1/ecommerce/products`.
2. **Lock stock at checkout** — when a customer starts checking out, reserve their cart's items with `POST /v1/ecommerce/stock-lock`, so nobody else (in-store or online) can sell the same units out from under them.
3. **Confirm the order** — once your own payment step succeeds, call `POST /v1/ecommerce/bills` to record the sale here and release the lock permanently into a real stock deduction. If payment fails or the customer abandons checkout, call `DELETE /v1/ecommerce/stock-lock/{id}` instead to release the hold.

## 4. Endpoints

### `GET /v1/ecommerce/products`

List active, stock-tracked products with live availability.

**Response:**
```json
{
  "products": [
    {
      "product_id": "opaque_token",
      "name": "Lays Chips — 20 Rs Pack",
      "price": 20.00,
      "currency": "INR",
      "available_stock": 45,
      "images": ["https://cdn.example.com/..."],
      "tax_code": "HSN_2106"
    }
  ]
}
```

`available_stock` is the same live figure the POS itself uses at checkout — it already accounts for anything currently locked (by any channel, not just yours).

### `GET /v1/ecommerce/products/{product_id}/stock`

Real-time stock check for a single product — useful right before checkout, in case the catalog was cached.

**Response:**
```json
{ "product_id": "opaque_token", "available_stock": 45 }
```

### `POST /v1/ecommerce/stock-lock`

Reserve stock for an in-progress order.

**Request:**
```json
{
  "product_id": "opaque_token",
  "quantity": 2
}
```

**Response:**
```json
{
  "lock_id": "opaque_token",
  "product_id": "opaque_token",
  "quantity": 2,
  "status": "active"
}
```

Returns `409 Conflict` if there isn't enough available stock to fulfil the request.

**Locks aren't permanent.** Release one explicitly (below) if the customer doesn't complete checkout — don't rely on any automatic timeout, since none is guaranteed.

### `DELETE /v1/ecommerce/stock-lock/{lock_id}`

Release a lock — abandoned cart, failed payment, expired session.

**Response:** `204 No Content` on success.

### `POST /v1/ecommerce/bills`

Record a completed online order. Call this only after payment has succeeded on your side — this endpoint does not process payment itself.

**Request:**
```json
{
  "customer": {
    "name": "Priya Sharma",
    "phone": "9876543210",
    "email": "priya@example.com"
  },
  "lines": [
    { "product_id": "opaque_token", "quantity": 2, "lock_id": "opaque_token" }
  ],
  "order_reference": "your-own-order-id-optional"
}
```

- `customer` — matched against an existing customer by phone, or created if no match (same behavior as in-store billing). Required — an online order needs a known buyer.
- `lock_id` on each line — pass the lock from Section 4's stock-lock call so the reservation converts directly into the sale, rather than a fresh availability check running again at this step.

**Response:**
```json
{
  "bill_id": "opaque_token",
  "document_number": "OB/2027-28/0142",
  "status": "completed",
  "grand_total": 40.00
}
```

`document_number` follows this store's `online_bill` numbering series — the same mechanism as every other document type in this system, just its own separate sequence.

## 5. Errors

Errors return a consistent shape:

```json
{ "error": { "code": "insufficient_stock", "message": "Only 1 unit available." } }
```

| HTTP Status | Meaning |
|---|---|
| 400 | Malformed request — check the body against the schema above |
| 401 | Invalid or missing credentials |
| 404 | Referenced product, lock, or customer not found |
| 409 | Stock conflict — not enough available to lock or bill |
| 429 | Rate limited — back off and retry |

## 6. Notes

- All amounts are in the store's `default_currency`.
- Stock figures reflect this store only — locks and bills against one store's credential never touch another store's inventory.
- This API is for catalog sync and order recording. Payment processing, shipping, and your storefront UI are entirely your own responsibility.
