# POS Application — step7: E-commerce Integration

Companion to **step1–6.md**. Covers a merchant connecting their own external e-commerce app/website to this POS, via a set of APIs, so their online stock and orders stay in sync with the in-store system.

**Scope of this document:**
1. E-commerce Settings page — API credentials, API list, downloadable integration guide
2. Bill type extension — `online_bill`, alongside Cash and Credit
3. Stock Lock for e-commerce — reserving stock for an online order, same mechanism as step4's Stock Block
4. The API set itself — product/stock lookup, lock, release, create online bill
5. Refund progress tracking and customer notifications, since online customers aren't present to be told in person

---

## 1. E-commerce Settings Page (Admin)

**What it's for:** where a merchant sets up their own external e-commerce app to talk to this POS — not the e-commerce app itself, which is built and hosted separately by (or for) the merchant.

**Behavior:**
- Generate and manage API credentials (Section 2) — create a new key, label it (e.g. "My Shopify Store"), revoke an old one.
- A list of the available APIs (Section 4), each with a short description of what it does.
- A downloadable integration guide — the document a merchant's developer actually needs to wire the two systems together. Available as a download button right on this page. (Drafted as `Ecommerce_API_Integration_Guide.md` — covers authentication, the typical flow, every endpoint with request/response examples, and error handling.)

## 2. API Credential — MST-APIKEY (step3 master)

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| store_id | FK → MST-STORE | credentials are store-scoped, same as everything else in this system |
| label | string | merchant's own name for this credential, e.g. "My Shopify Integration" |
| api_key | string, unique | public identifier, safe to log |
| api_secret_hash | string | the secret is shown once at creation, then only ever stored hashed — never retrievable again, only revocable and replaceable |
| is_active | boolean | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |
| last_used_at | timestamp (UTC), nullable | |
| revoked_at | timestamp (UTC), nullable | |

**This is a master change to step3.md** — a new entity, since nothing like it existed before this document.

## 3. Bill Type: Online Bill

`TXN-BILL.bill_type` (step5, Section 11) gains a third value: `online_bill`, alongside `cash_bill` and `credit_bill`. It gets its own MST-NUMSERIES `series_type` — `online_bill` — same as every other document type, never sharing a sequence with the in-store bill types.

**Customer:** required, same rule as Credit Bill (Section 5) — an online order needs a known buyer (for delivery/contact details), so `customer_id` can't be null for this bill type either.

## 4. Stock Lock for E-commerce

Reuses step4 Section 3's Stock Block mechanism directly rather than inventing a parallel one. `source_type` (step4, Section 3) gains a fourth value: `ecommerce_order` — alongside `manual`, `pending_transfer`, `draft_bill_line`.

**Behavior:** when a customer on the e-commerce site adds an item to their cart or starts checkout, the Stock Lock API (Section 5 below) creates a `stock_block_item` with `source_type = ecommerce_order`. This holds the stock — unavailable to sell in-store or to another online customer — until one of two things happens: the lock is explicitly released (cart abandoned, checkout failed) or an Online Bill completes, at which point the block releases and the permanent deduction in step4 Section 7's formula takes over — the same pattern already established for draft Bill Lines and pending Transfers.

## 5. The API Set

All authenticated using the credentials from Section 2 (API key + secret), store-scoped — a credential for Store A can't touch Store B's data.

| Endpoint | Purpose |
|---|---|
| `GET /v1/ecommerce/products` | List active, stock-tracked Products — name, price, images, tax info, and live `available` stock (step4 Section 7's figure via `/lib/stock`) — for populating the online catalog |
| `GET /v1/ecommerce/products/{product_id}/stock` | Real-time stock check for one product, same `/lib/stock` figure |
| `POST /v1/ecommerce/stock-lock` | Reserve a quantity for a product × warehouse — creates the `stock_block_item` from Section 4 |
| `DELETE /v1/ecommerce/stock-lock/{id}` | Release a lock — abandoned cart, failed checkout |
| `POST /v1/ecommerce/bills` | Create an Online Bill (Section 3) — called once the order is confirmed/paid on the e-commerce app's own side; releases the corresponding stock lock and permanently deducts stock the same way any other completed bill does |

**Payment stays outside this API set.** How the e-commerce app collects payment (its own gateway, checkout flow) is between the merchant and their e-commerce platform — this API only records the resulting order and keeps stock in sync. It doesn't process payment itself.

## 6. Refund Progress & Customer Notifications

**What it's for:** an online customer isn't standing at the counter — they can't be told in person that their refund is processing or their order got cancelled. The system has to tell them.

**Refund progress, made granular.** step5 Section 8's `TXN-REFUND.status` extends from `pending` / `completed` / `failed` to include `processing` — the in-between stage while a gateway refund is actually settling (these commonly take days, not seconds, so "pending" alone hides real information a customer would want).

**Notification — `TXN-NOTIFICATION`:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| customer_id | FK → MST-CUST | |
| event_type | enum | `refund_processing` / `refund_completed` / `refund_failed` / `order_cancelled` |
| channel | enum | `email` / `sms` — chosen based on which contact detail MST-CUST has on file |
| related_type | enum | `refund` / `bill_cancellation` |
| related_id | FK, polymorphic | the specific TXN-REFUND or TXN-BILL-CANCELLATION record that triggered this |
| status | enum | `pending` / `sent` / `failed` |
| sent_at | timestamp (UTC), nullable | |
| created_at | timestamp (UTC) | |

**When this fires — scoped to `online_bill`:** every status change on a Refund (Section 8, step5) against an online bill creates a Notification row for the new status. Every Bill Cancellation (Section 9, step5) where the cancelled bill's `bill_type = online_bill` creates one with `event_type = order_cancelled`. In-store bills (Cash, Credit) don't trigger this — the customer's physically there for those — though nothing stops extending it later if that's wanted too.

---

## Master changes this document required (in step3.md)

**New master: MST-APIKEY** (Section 2 above) — API credentials didn't exist as a concept before this document.

**MST-NUMSERIES's `series_type` gains `online_bill`** — same pattern as every other document type.

## Master changes this document required (in step4.md)

**Stock Block's `source_type` gains `ecommerce_order`** (Section 4 above) — reuses the existing block mechanism rather than adding a parallel reservation system.

## Master changes this document required (in step5.md)

**Bill's `bill_type` gains `online_bill`** (Section 3 above).

**Refund's `status` enum gains `processing`** (Section 6 above) — between `pending` and `completed`, reflecting that a gateway refund actually takes time to settle.

**New entity: `TXN-NOTIFICATION`** (Section 6 above) — didn't exist before this document; tracks every refund-progress and cancellation message sent to a customer.

---

## Update 2026-09-07: orders land pending, not as a completed bill

Built and shipped after real usage surfaced a gap in Section 5's original design: `POST /v1/ecommerce/bills` created a **completed, invoiced** Online Bill the instant it was called — meaning any order the store later couldn't actually fulfil (stock issue, delivery problem, anything) had already burned a real GST document number and had to be formally reversed to undo. There was no point between "payment confirmed on the storefront" and "this is now a real invoice" for a store to say no.

**New entity: `TXN-ECOMMERCE-ORDER`** (`ecommerce_orders` / `ecommerce_order_items` / `ecommerce_order_payments`) — a staging order, separate from Bill. Every field the old Section 3 bill type would have needed (customer snapshot, shipping address/city/taluk/state/country/pincode, line items with product/qty/price, and whatever the storefront told us about how the customer paid) lives here first. Its own numbering series, `ecommerce_order` (prefix `EO`) — distinct from `online_bill`, which is now only allocated once a real bill actually gets created.

**`POST /v1/ecommerce/bills` is retired.** Replaced by `POST /v1/ecommerce/orders`, same idea (called once payment is confirmed on the storefront's side) but it creates a `pending` `TXN-ECOMMERCE-ORDER`, never a Bill. Stock is still locked exactly as Section 4 describes — reusing the same `stock_block_item` / `source_type = ecommerce_order` mechanism — except the lock created (or consolidated, if the order needed stock split in from another store) at order-placement time no longer carries the abandoned-cart expiry a shopping-cart lock does; it holds firm for as long as the order stays pending.

**New staff screen: Online Orders** (in the existing POS admin, gated on the `billing` module like everything else Bill-adjacent) — lists every `TXN-ECOMMERCE-ORDER` for the store. Opening a `pending` one offers exactly two actions:

- **Accept** — this is the moment Section 3's Online Bill actually gets created: `online_bill` document number allocated now (not before), tax resolved, bill lines written, and each item's stock lock converted into the permanent deduction (released, same as the original flow did inline). The order becomes `accepted` and links to the new bill.
- **Reject** — every item's stock lock is released back to available stock. No bill, no document number, nothing to reverse. The order becomes `rejected` with a staff-entered reason.

**Section 6's notifications gain `order_rejected`** (`TXN-NOTIFICATION.event_type`, `related_type` gains `ecommerce_order`) — fires on Reject, same channel-selection and Notifier-adapter mechanism already used for `order_cancelled`. Combined with the existing refund/cancellation notifications (which still apply from Accept onward, since only then does a real bill exist to refund or cancel), a customer is now told automatically at every stage their order might not go through — not just the ones that happen after a bill already existed.

Section 5's API table is superseded by:

| Endpoint | Purpose |
|---|---|
| `POST /v1/ecommerce/orders` | Create a pending order (Section-3-shaped payload plus optional shipping detail and payment info) — stock is locked/reserved in full, no bill yet |
| `GET /v1/ecommerce/orders/{order_id}` | Order lookup at any stage — pending, accepted (bill totals merged in), or rejected |
| `GET /v1/ecommerce/customers/{customer_id}/orders` | A customer's order history across every stage |

`GET /v1/ecommerce/products` and `/products/{id}` also gained `stockByStore` (the per-store breakdown behind the combined `available` total) for a multi-store integration that lets the shopper pick a store — see the integration guide for when that actually matters.
