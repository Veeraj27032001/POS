# E-commerce API Integration Guide

This guide is for the developer connecting your own e-commerce app/website to
this POS, so your online stock and orders stay in sync with your in-store
system.

Payment is **not** part of this API. However your e-commerce app collects
payment is between you and your payment provider — this API only records the
resulting order and keeps stock in sync once the order is confirmed/paid.

## 1. Authentication

Every request needs two headers, taken from a credential created on the
**Settings → E-commerce** page:

```
X-Api-Key: pk_xxxxxxxxxxxxxxxxxxxxxxxxxx
X-Api-Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The secret is shown only once, at creation — store it securely on your own
server, never in client-side code. A credential is scoped to one store; it
can never see or affect another store's data. If a credential is
compromised, revoke it from the same settings page and create a new one.

All responses are JSON. Errors look like:

```json
{ "error": { "code": "bad_request", "message": "…" } }
```

## 2. Typical flow

1. Populate your catalog from `GET /v1/ecommerce/products`, refreshing stock
   periodically or checking `GET /v1/ecommerce/products/{id}/stock` at
   checkout time.
2. When a customer starts checkout, call `POST /v1/ecommerce/stock-lock` for
   each line to reserve the stock — this keeps it from being sold in-store or
   to another online customer while they pay.
3. If checkout fails or the cart is abandoned, call
   `DELETE /v1/ecommerce/stock-lock/{id}` to release it.
4. Once your payment provider confirms the order, call
   `POST /v1/ecommerce/bills` with the same product/warehouse/quantity as
   your lock(s) — this releases the lock(s) and permanently deducts the
   stock. Payment itself is never sent to this API.

Locking before billing is recommended but not required — `POST
/v1/ecommerce/bills` will check availability itself if a line has no
`stock_lock_id`.

## 3. Endpoints

### `GET /v1/ecommerce/products`

Query params: `page`, `pageSize` (max 200, default 50), `search`.

```json
{
  "totalRecords": 42,
  "totalPages": 1,
  "page": 1,
  "pageSize": 50,
  "data": [
    {
      "id": "…",
      "name": "…",
      "description": "…",
      "price": 199.0,
      "images": ["https://…"],
      "systemBarcode": "…",
      "categoryName": "…",
      "available": 23,
      "tax": { "hsnCode": "…", "cgstRate": 9, "sgstRate": 9, "igstRate": 18 }
    }
  ]
}
```

`tax` is `null` when tax display isn't configured for this store.

### `GET /v1/ecommerce/products/{product_id}/stock`

```json
{ "productId": "…", "available": 23 }
```

### `POST /v1/ecommerce/stock-lock`

```json
{
  "productId": "…",
  "warehouseId": "…",
  "quantity": 2,
  "externalReference": "cart_abc123"
}
```

`warehouseId` is optional if your store has exactly one warehouse;
`externalReference` is an optional free-text string (e.g. your own cart or
order id) stored for traceability.

Response (`201`):

```json
{ "lockId": "…", "productId": "…", "warehouseId": "…", "quantity": 2 }
```

`400` if the requested quantity exceeds what's available.

### `DELETE /v1/ecommerce/stock-lock/{id}`

Releases a lock created above. `{id}` is the `lockId` from the create
response.

```json
{ "released": true }
```

### `POST /v1/ecommerce/bills`

```json
{
  "billDate": "2027-06-01",
  "customer": { "name": "Jane Doe", "phone": "+919999999999", "email": "jane@example.com" },
  "lines": [{ "productId": "…", "warehouseId": "…", "quantity": 2, "stockLockId": "…" }]
}
```

`billDate` defaults to today. `customer` is matched to an existing customer
by phone, or a new one is created. `stockLockId` on a line is optional — omit
it to have this call check availability itself instead of releasing a prior
lock. When given, its product/warehouse/quantity must match the line exactly.

Response (`201`): the created bill, `status: "completed"`, with its lines.

## 4. Errors

| Status | Meaning                                                      |
| ------ | ------------------------------------------------------------ |
| 401    | Missing or invalid `X-Api-Key`/`X-Api-Secret`                |
| 400    | Bad input, insufficient stock, or a mismatched `stockLockId` |
| 404    | Product/stock lock not found for this credential's store     |

## 5. Refund & cancellation notifications

Once an order is created through this API, the customer is notified by
email or SMS (whichever contact detail they have on file) when: a refund
against that order is issued, and if the order is later cancelled. No
integration work is needed for this — it happens automatically on the POS
side.
