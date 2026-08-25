# POS Application — step0: System Overview

This is the index and summary for the full specification — step1 through step6. Read this first for the shape of the whole system; read the individual documents for the actual field-level detail.

---

## What this is

A store-scoped, multi-warehouse retail POS built on Next.js, covering: technical base patterns, the Next.js project setup, master/reference data, stock management, billing, and reporting. Built for the India market (GST, HSN, ₹, financial-year-based numbering) but with a few things (the tax engine, currency handling) deliberately kept generic underneath, so a second country is configuration later, not a rewrite.

## Document Map

| Doc | Covers |
|---|---|
| **step1.md** | Technical base — reusable engineering patterns, independent of this specific app: pagination (BASE-DTR), date/time (BASE-DTH), security (BASE-SEC), routing/middleware (BASE-RTE), file uploads (BASE-FUP), validation (BASE-VAL), keyboard navigation (BASE-NAV) |
| **step2.md** | Next.js project setup — framework/language/tooling decisions, folder structure, and the shared `/lib` utilities (`pagination`, `datetime`, `security`, `upload`, `stock`, `credit`, `validation`) that every feature calls into rather than reimplementing |
| **step3.md** | Masters — 19 reference-data entities: Product, Category, UOM, Tax Engine, Customer, Supplier, Store, Warehouse, Terminal, Payment Method, Price List/Discount, Reason Codes, Cash Denominations, Loyalty Rules, Users, RBAC, Financial Year, Numbering Series, API Credential |
| **step4.md** | Stock management — Inward, Damage, Temporary Block, Transfer (cross-store, with approval), Positive/Negative Adjustment, Opening Balance, Expiry lifecycle, Entry Correction, Low Stock Check. Every entity is a `_main` header with `_item` product lines |
| **step5.md** | Billing — Financial Year at login, Bill Numbering, Customer selection, QR/Link payment, Scan-to-add, Refund, Cancellation, Return + Credit Note, the Bill itself (with multi-warehouse line allocation, hold/park, split payment), Credit Bill outstanding balance, Shift/cash reconciliation |
| **step6.md** | Reports — 29 reports across Stock, Sales & Billing, Financial/Tax, and Staff & Operations, plus the shared filter mechanism they all draw from |
| **step7.md** | E-commerce Integration — a merchant's external online store connecting via API: credentials, product/stock lookup, stock locking, and the new `online_bill` type. Ships with a standalone developer guide (`Ecommerce_API_Integration_Guide.md`) |
| **step8.md** | Dashboard/Home Screen — today's sales plus the low-stock, stale-block, stale-held-bill, pending-transfer, and outstanding-balance widgets, all thin views over calculations already defined elsewhere |
| **step9.md** | Platform Admin Console — a **separate application**, used by the vendor to manage every merchant running this POS: access tokens, degrade/suspend service (whole or by module), and vendor-to-merchant notifications. Has its own database, entirely apart from any merchant's POS data |
| **step10.md** | Mobile Scanner Companion App — **another separate application**: a Flutter (Android + iOS) app pairing with a terminal over Bluetooth, turning a phone camera into a barcode scanner alongside the existing physical-scanner support |

## Themes that run across every document

- **Store-scoping, everywhere.** A user sees only their own store's data unless their role is explicitly cross-store (Admin). Enforced two ways, always together: RBAC (what actions a role can take) and a `store_id` filter (which store's data those actions touch).
- **Every transaction is numbered and financial-year-scoped.** `document_number` + `financial_year_id` + `store_id` sit on every transactional table across step4 and step5, drawn from MST-NUMSERIES — 20 separate series, one per document type, never shared.
- **Header + line-item shape for anything multi-product.** Bill/Bill Line, and every step4 stock entity (`_main`/`_item`), avoid forcing one document number per single product when several products moved together.
- **Nothing important is calculated twice.** Stock availability (`/lib/stock`), Credit Bill balance (`/lib/credit`), and validation rules (`/lib/validation`) each live in exactly one shared function, called by every screen that needs them — never re-derived per feature.
- **Visible, not automatic, for anything a human should decide.** Expired stock, stale Stock Blocks, stale held bills — all surfaced for manual action, never silently resolved by the system on its own.
- **Append-only history, with logged corrections.** Nothing gets silently edited. A mistake is fixed through Section 8/10-style correction and extension logs (step4) that keep the old value, not by overwriting it.
- **GST compliance woven in, not bolted on.** The tax engine (step3, generic Region→Scheme→Component→Code, India-scoped for now), mandatory HSN per product, Credit Notes on both Returns and completed-bill Cancellations, and store GSTIN on every relevant document.

## Still genuinely open

Carried over honestly from each document rather than left buried:

- **Database engine** (step2, NJS-06) — being decided outside this spec.
- **Hosting target** (step2, NJS-29) — undecided; the architecture was deliberately kept hosting-agnostic so this doesn't block anything.
- **Discount limits tied to RBAC** (step5) — raised, not yet built.
- **General staff notifications** (offered, not selected) — low stock, incoming transfer requests, and stale items are all on step8's Dashboard, but nothing proactively pushes them to staff; someone still has to open the Dashboard to see them.

## ID / naming legend

- `BASE-*` — step1's cross-cutting technical requirements
- `NJS-*` — step2's Next.js project decisions
- `MST-*` — step3's masters
- `TXN-*` / `stock_*_main` / `stock_*_item` — step4/step5's transactional entities
- `snake_case` field and table names throughout, matching what an actual schema would use
