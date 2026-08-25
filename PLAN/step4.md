# POS Application — step4: Stock Management (Inward, Damage, Temporary Block)

Companion to **step1.md** (technical base), **step2.md** (Next.js setup), and **step3.md** (masters).

**Scope of this document — exactly eleven things, nothing beyond them:**
1. Stock Inward — adding stock in
2. Stock Damage — writing off stock that's no longer sellable
3. Stock Block (Temporary) — reserving stock so it can't be sold, without removing it
4. Stock Transfer — a request from one store to another, blocked until accepted or rejected (or direct, if same-store)
5. Positive Stock Adjustment — stock found during a physical recount
6. Opening/Initial Stock Balance — the starting count when a warehouse first goes live
7. Expired Stock Visibility & Invalidation — expiry is shown, never auto-blocked; staff invalidate it manually
8. Stock Expiry Date Extension — pushing out an expiry date, fully logged
9. Negative Stock Adjustment — stock missing during a physical recount
10. Entry Correction — fixing a data-entry mistake, fully logged
11. Low Stock Check — connecting reorder_level to an actual computed total
12. Stock Retest — periodic re-inspection of stock already in the warehouse, not the at-receiving check
13. Product Request — the formal vendor-ordering workflow, matched against what Section 1 actually receives

Sales/checkout, payments, purchase orders, returns, voids, and shifts are **not** covered here. Only what's specified below is defined — no ledger, balance, or "what happens on submit" mechanics beyond what's been explicitly stated. That logic waits until it's actually stated.

**Structure, applied consistently below:** every transaction here is a **`_main`** header (one document — its number, financial year, store, warehouse) plus one or more **`_item`** rows (the actual products on that document). A single delivery, recount, or transfer note commonly covers several different products at once — this avoids forcing a separate document number per product when they all happened together.

---

## 1. Stock Inward — `stock_inward_main` / `stock_inward_item`

**What it's for:** recording stock coming into a warehouse — one document, multiple products.

**stock_inward_main (header):**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | BASE-SEC-01 |
| document_number | string | drawn from MST-NUMSERIES (series_type=`stock_inward`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| supplier_id | FK → MST-SUP, nullable | who it came from, if relevant to record |
| purchase_order_id | FK → `product_request_main`, nullable | which Product Request (Section 13) this receipt fulfills, if any — direct receiving without a prior request is still supported, this just links the two when there was one |
| notes | text, nullable | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**stock_inward_item (one row per product on this document):**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_inward_main_id | FK → stock_inward_main | |
| product_id | FK → MST-PRD | the exact product being received |
| quantity_accepted | integer | good/sellable product received — this is what enters on-hand stock |
| quantity_rejected | integer, nullable | rejected/damaged product noted at the time of receipt — recorded for accountability only; it never enters on-hand stock, so no separate Damage record (Section 2) is needed for it — Damage is for stock that *was* in inventory and later became unsellable, whereas this was never accepted in the first place |
| expiry_date | date, nullable | this item's batch expiry — only applicable if the product's MST-PRD.track_expiry is true. **Not directly editable once set** — changing it later only happens through Section 8's Extension action, never a plain edit |
| expiry_invalidated | boolean, default false | set true once staff manually invalidate this item's expired quantity |
| expiry_invalidated_by_user_id | FK → MST-USER, nullable | |
| expiry_invalidated_at | timestamp (UTC), nullable | |
| unit_cost | decimal, nullable | what this item's stock cost, if known — updates the product's `default_cost_price` (step3) so the "default" cost always reflects the most recent inward |

## 2. Stock Damage — `stock_damage_main` / `stock_damage_item`

**What it's for:** recording stock that's no longer sellable — broken, expired, spoiled — one inspection, multiple products.

**stock_damage_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`stock_damage`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| notes | text, nullable | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**stock_damage_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_damage_main_id | FK → stock_damage_main | |
| product_id | FK → MST-PRD | |
| quantity | integer | |
| reason_code_id | FK → MST-REASON (category=`damage`) | per item — different products in the same inspection can have different reasons |

**Validation (BASE-VAL):** `quantity` on any item can't exceed that product's live `available` figure (Section 7) at this warehouse — can't damage more than what's actually there.

## 3. Stock Block (Temporary) — `stock_block_main` / `stock_block_item`

**What it's for:** marking quantities of stock as temporarily unavailable to sell, without removing them — one blocking event can cover multiple products, each released independently — reversible per item.

**stock_block_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`stock_block`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| source_type | enum, default `manual` | `manual` / `pending_transfer` / `draft_bill_line` / `ecommerce_order` — what created this block, so an auto-generated one can be found and auto-released by whatever caused it |
| source_id | FK, polymorphic, nullable | the Transfer or Bill Line this block exists for, when source_type isn't `manual` |
| review_by_date | date, nullable | optional deadline the blocker sets for when this should be revisited — not an auto-release, just a way to flag it for review (see the Stale Blocks note below). Not applicable to system-generated blocks, which release on their own trigger instead |
| blocked_by_user_id | FK → MST-USER | |
| blocked_at | timestamp (UTC) | |

**stock_block_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_block_main_id | FK → stock_block_main | |
| product_id | FK → MST-PRD | |
| quantity_blocked | integer | |
| reason_code_id | FK → MST-REASON (category=`stock_block`) | for a `manual` block, staff pick this per item. For a system-generated one, it's set automatically to a pre-seeded reason (e.g. "Reserved — pending bill", "Reserved — pending transfer") |
| status | enum | `active` / `released` — each item in a block releases independently of the others |
| released_by_user_id | FK → MST-USER, nullable | null for a system-triggered release |
| released_at | timestamp (UTC), nullable | |

**Stale blocks — same philosophy as expiry (Section 7): visible, never automatic.** An item never auto-releases on its own, even past its main's `review_by_date` — that would silently make stock sellable again with no human decision behind it. Instead, any `active` item whose block is past `review_by_date` (or, if that wasn't set, active longer than a configurable default) shows up in a Stale Blocks list, the same way expired stock surfaces on the Invalidate page — staff decide from there whether to release it or leave it blocked.

## 4. Stock Transfer — `stock_transfer_main` / `stock_transfer_item`

**What it's for:** moving stock from one store's warehouse to another's, via a request the destination must accept or reject — one request, multiple products.

**stock_transfer_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`stock_transfer`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | the requesting (source) store — the transfer's own numbering series belongs to whoever initiated it |
| source_warehouse_id | FK → MST-WH | where it's transferring from |
| destination_warehouse_id | FK → MST-WH | where it's transferring to |
| status | enum | `pending` / `accepted` / `rejected` / `cancelled` — applies to the whole request; all items move together |
| requested_by_user_id | FK → MST-USER | also the only one who can cancel this request |
| requested_at | timestamp (UTC) | |
| responded_by_user_id | FK → MST-USER, nullable | who reviewed and accepted/rejected — not set for a `cancelled` request, since that's the requester's own action |
| responded_at | timestamp (UTC), nullable | |
| cancelled_at | timestamp (UTC), nullable | set only when the requester cancels their own pending request |
| notes | text, nullable | |

**stock_transfer_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_transfer_main_id | FK → stock_transfer_main | |
| product_id | FK → MST-PRD | |
| quantity | integer | quantity requested/sent for this product |
| quantity_accepted | integer, nullable | good/sellable portion of this item — filled in by the receiver when reviewing; this is what enters on-hand stock at the destination |
| quantity_rejected | integer, nullable | damaged/unacceptable portion of this item found on review — filled in alongside quantity_accepted, summing to `quantity`. Recorded for accountability only, never enters destination stock, no separate Damage record needed |
| expiry_date | date, nullable | expiry of this item's stock, confirmed by the receiver alongside quantity_accepted — only applicable if MST-PRD.track_expiry is true. **Not directly editable once set** — only Section 8's Extension action can change it |
| expiry_invalidated | boolean, default false | set true once staff manually invalidate this item's expired quantity |
| expiry_invalidated_by_user_id | FK → MST-USER, nullable | |
| expiry_invalidated_at | timestamp (UTC), nullable | |

**Stated behavior:** while status is `pending`, every item's `quantity` is blocked at the source warehouse (Section 3's Stock Block, `source_type = pending_transfer`, `source_id` = this transfer) — the source store can't sell any of it during that window. The receiving side's job is reviewing the whole request: if `rejected` outright, those blocks release and the stock becomes available again at the source. If `accepted`, the receiver's review also records, per item, how much was good (`quantity_accepted`) versus rejected on inspection (`quantity_rejected`) — it isn't an all-or-nothing accept.

**Cancellation:** the requester can cancel their own request while it's still `pending` (not after the destination has responded) — status becomes `cancelled`, and the source blocks release exactly like a rejection does. The difference from `rejected` is who acted: the source pulling back their own offer, versus the destination declining it.

**Same-store transfers:** if `source_warehouse_id` and `destination_warehouse_id` belong to the same store (step3, MST-WH.store_id), the accept/reject workflow above doesn't apply — there's no cross-store trust boundary to check. The transfer is direct: status is set to `accepted` immediately on creation, with each item's `quantity_accepted` = `quantity` and no `pending`/blocking step. The full request-and-review workflow is only for transfers between different stores.

**Cross-store visibility carve-out:** picking a destination warehouse means seeing warehouses outside your own store, which store-scoping (step3, Sections 7/11/12) otherwise prevents entirely. The carve-out is narrow: creating a transfer exposes a directory of active warehouses — name and parent store name only — across all stores, for selection purposes. It does not expose that store's stock levels, balances, or anything else; store-scoping still fully applies to every other screen and to this warehouse's data once selected. Only its existence and name are visible outside its own store.

## 5. Positive Stock Adjustment — `stock_positive_adjustment_main` / `stock_positive_adjustment_item`

**What it's for:** stock found during a physical recount that the system didn't previously account for — one recount, multiple products.

**stock_positive_adjustment_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`positive_adjustment`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| notes | text, nullable | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**stock_positive_adjustment_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_positive_adjustment_main_id | FK → stock_positive_adjustment_main | |
| product_id | FK → MST-PRD | |
| quantity | integer | |
| expiry_date | date, nullable | only applicable if MST-PRD.track_expiry is true. **Not directly editable once set** — only Section 8's Extension action can change it |
| expiry_invalidated | boolean, default false | |
| expiry_invalidated_by_user_id | FK → MST-USER, nullable | |
| expiry_invalidated_at | timestamp (UTC), nullable | |
| reason_code_id | FK → MST-REASON (category=`stock_adjustment`) | per item |

## 6. Opening / Initial Stock Balance — `stock_opening_main` / `stock_opening_item`

**What it's for:** the one-time starting count entered when a warehouse first goes live — one document, every product it starts with.

**stock_opening_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`opening_balance`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| notes | text, nullable | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**stock_opening_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_opening_main_id | FK → stock_opening_main | |
| product_id | FK → MST-PRD | |
| quantity | integer | |
| expiry_date | date, nullable | only applicable if MST-PRD.track_expiry is true. **Not directly editable once set** — only Section 8's Extension action can change it |
| expiry_invalidated | boolean, default false | |
| expiry_invalidated_by_user_id | FK → MST-USER, nullable | |
| expiry_invalidated_at | timestamp (UTC), nullable | |

## 7. Expired Stock Visibility & Invalidation

**What it's for:** expiry is fully manual, not an automatic block — stock past its expiry date stays sellable and shows up in billing like anything else. The system's job is to make expiry visible and give staff a place to act on it, not to make the call for them.

**Stock totals shown anywhere (e.g. at billing):** for a given product × warehouse —

```
on_hand  =  stock_inward_item.quantity_accepted                 (Section 1, this warehouse via its main, not expiry_invalidated)
          + stock_transfer_item.quantity_accepted                (Section 4, this warehouse as DESTINATION, main.status = accepted)
          − stock_transfer_item.quantity_accepted                (Section 4, this warehouse as SOURCE, main.status = accepted — it left)
          + stock_positive_adjustment_item.quantity               (Section 5, this warehouse)
          + stock_opening_item.quantity                           (Section 6, this warehouse, not expiry_invalidated)
          − stock_damage_item.quantity                            (Section 2, this warehouse)
          − stock_negative_adjustment_item.quantity                (Section 9, this warehouse)
          − Bill Line Warehouse Allocation.quantity   (step5, Section 11's allocation table — only rows for this warehouse, where the parent Bill Line's status = `active` and the parent Bill's status = `completed`)
          + Return Line.quantity                       (step5, Section 10 — only rows for this warehouse where condition = `sellable`)

available = on_hand − active stock_block_item.quantity_blocked  (Section 3, this warehouse)

expired_not_invalidated = the slice of the additive items above (Inward/Transfer-in/Positive Adjustment/Opening)
                           where expiry_date has passed and expiry_invalidated is still false
```

`available` is what checkout, Section 11's low-stock check, and step5's oversell prevention all use. `expired_not_invalidated` is the "20 in stock, 10 expired" figure shown alongside `on_hand` — visible, but not blocking a sale, per the manual-invalidation rule below.

**This lives in exactly one place.** `on_hand`, `available`, and `expired_not_invalidated` are computed by a single shared function — not reimplemented per screen or per feature. Every consumer (billing's oversell check, Section 11's low-stock check, this page's totals, any future stock report) calls that one function rather than re-deriving the sum itself. Per step2's NJS-32 folder convention, this belongs alongside the other shared base utilities: `/lib/stock/getStockLevels.ts` (or equivalent) is the only place this math is written — a change to the formula happens once, there, and every consumer picks it up automatically instead of needing to be found and updated separately.

**Invalidate Expired Stock (page):** lists every item, across Sections 1/4/5/6, where `expiry_date` has passed and `expiry_invalidated` is still false. From this list, staff manually invalidate an item — this is what actually removes that quantity from the totals shown anywhere, including billing. Until invalidated, expired stock keeps counting as available stock; both expired and non-expired quantity remain choosable at the point of sale either way.

**Extend is available from this same page.** Reviewing an expired item doesn't only lead to invalidating it — staff can instead trigger Section 8's Extension action right from this list, pushing the expiry_date out instead of writing the stock off. Both actions are one click away from the same row; nothing requires leaving this page to do either.

## 8. Stock Expiry Date Extension — `stock_expiry_extension`

**What it's for:** extending the expiry_date on an existing item, with every extension permanently logged. Applies to any of the four expiry-carrying item tables above (Sections 1, 4, 5, 6).

**Extension log (append-only):**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`expiry_extension`), scoped to the source item's warehouse's store + the active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this extension was made |
| store_id | FK → MST-STORE | derived from the source item's warehouse's store, stored directly |
| source_item_type | enum | `stock_inward_item` / `stock_transfer_item` / `stock_positive_adjustment_item` / `stock_opening_item` — which item table this extension applies to |
| source_item_id | FK (polymorphic) | the specific item row whose expiry_date was extended |
| previous_expiry_date | date | |
| new_expiry_date | date | must be later than previous_expiry_date — this extends, it doesn't arbitrarily change the date |
| was_already_expired | boolean | true if `previous_expiry_date` had already passed at the moment of extension (done from the Invalidate page, Section 7) — false if it was extended proactively, before lapsing (done from this page). Tracked separately since these are different situations, not the same action twice. |
| notes | text, nullable | |
| extended_by_user_id | FK → MST-USER | |
| extended_at | timestamp (UTC) | |

**Extend Expiry (page):** its own dedicated list, separate from Invalidate Expired Stock — every item across Sections 1/4/5/6 that has a non-null `expiry_date`, not just ones already expired. Selecting a row triggers the extension action above (writes previous/new date + who/when to the log, updates the item's `expiry_date`). Being on its own page means staff can proactively push out a date *before* it lapses, not only react to it after — Section 7's Invalidate page still offers the same extend action inline for anything already expired, so both paths reach the same log either way.

## 9. Negative Stock Adjustment — `stock_negative_adjustment_main` / `stock_negative_adjustment_item`

**What it's for:** the counterpart to Section 5 — stock found to be *missing* during a physical recount (shrinkage, miscount, unrecorded loss), as opposed to Section 5's Positive Adjustment for stock found in excess. One recount, multiple products.

**stock_negative_adjustment_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`negative_adjustment`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| notes | text, nullable | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**stock_negative_adjustment_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_negative_adjustment_main_id | FK → stock_negative_adjustment_main | |
| product_id | FK → MST-PRD | |
| quantity | integer | the shortfall amount |
| reason_code_id | FK → MST-REASON (category=`stock_adjustment`) | same category as Section 5 — both are recount corrections, just in opposite directions |

**Validation (BASE-VAL):** `quantity` can't exceed the product's live `available` figure (Section 7) at this warehouse — a recount can't report a shortfall bigger than what the system thought was there.

## 10. Entry Correction — `stock_entry_correction`

**What it's for:** fixing a plain data-entry mistake — wrong quantity typed in — on any item row from Sections 1, 2, 5, 6, or 9. Same append-only-log pattern as Section 8's expiry extension: the original item's quantity is a live field that can change, but every change is permanently recorded, never silently overwritten.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`entry_correction`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this correction was made |
| store_id | FK → MST-STORE | derived from the source item's warehouse's store, stored directly |
| source_item_type | enum | `stock_inward_item` / `stock_damage_item` / `stock_positive_adjustment_item` / `stock_negative_adjustment_item` / `stock_opening_item` |
| source_item_id | FK (polymorphic) | the specific item row being corrected |
| field_corrected | string | which field changed — e.g. `quantity_accepted`, `quantity_rejected`, `quantity` |
| previous_value | integer | |
| new_value | integer | |
| notes | text, nullable | why — encouraged, not enforced as a required reason code, since this is correcting a mistake rather than recording a new business event |
| corrected_by_user_id | FK → MST-USER | |
| corrected_at | timestamp (UTC) | |

**Effect:** the source item's field is updated to `new_value`, exactly like Section 8's extension updates `expiry_date`. **Not covered by this mechanism:** Sections 3 (Block) and 4 (Transfer) — those already have their own state-change trail (status, released_at/responded_at, and review_by_date), so a correction to those goes through their own fields rather than this log.

## 11. Low Stock Check

**What it's for:** connecting step3's `reorder_level` (MST-PRD) to an actual number, using the same total-quantity computation Section 7 already defines.

**Rule:** for a given product × warehouse, if `available` (Section 7's corrected formula — on_hand minus active blocks, with Damage/Negative Adjustment/transfer-out already subtracted) falls at or below that product's `reorder_level`, it's flagged as low stock. No new field needed — this reuses Section 7's number and step3's existing threshold rather than a separate stored value that could drift out of sync with the real count.

## 12. Stock Retest — `stock_retest_main` / `stock_retest_item`

**What it's for:** re-checking the quality of stock that's already been sitting in the warehouse — a year later, say — distinct from Section 1's at-receiving accept/reject check. One retest event, multiple products.

**stock_retest_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`stock_retest`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | |
| notes | text, nullable | |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**stock_retest_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| stock_retest_main_id | FK → stock_retest_main | |
| product_id | FK → MST-PRD | |
| quantity_tested | integer | total quantity checked in this retest, for this product |
| quantity_passed | integer | how much of `quantity_tested` was fine — stays in stock, unaffected |
| quantity_failed | integer | how much failed — `quantity_passed` + `quantity_failed` must equal `quantity_tested`, same split pattern as Section 1's Inward and Section 4's Transfer |
| notes | text, nullable | |
| damage_item_id | FK → stock_damage_item, nullable | set automatically when `quantity_failed` > 0 — see below |

**A non-zero `quantity_failed` doesn't invent a new way to remove stock** — it creates a `stock_damage_main`/`stock_damage_item` (Section 2) for exactly that failed quantity, with a pre-seeded reason code ("Failed quality re-test") under the existing `damage` category, and links back via `damage_item_id`. Section 7's stock formula already subtracts Damage, so a failed retest reduces `on_hand` through the exact same path a manually-recorded damage entry would — no parallel deduction logic to keep in sync. `quantity_passed` needs no action at all — it just stays in stock.

**If everything passes,** `quantity_failed` is 0 and no Damage record gets created — the retest row itself is the audit trail of "this was checked, on this date, and passed." Nothing separate needs to track a "last tested" date elsewhere.

**Validation (BASE-VAL):** `quantity_tested` can't exceed the product's live `available` figure (Section 7) at this warehouse — can't retest more than what's actually on the shelf. `quantity_passed + quantity_failed` must equal `quantity_tested` exactly.

## 13. Product Request — `product_request_main` / `product_request_item`

**What it's for:** the formal vendor-ordering workflow that Sections 1's direct Stock Inward deliberately didn't cover on its own — a supplier is selected, a request is raised on a given date, and what actually arrives later (Section 1) is matched back against it. This is what makes "did the vendor send what we ordered" an answerable question instead of just a running list of unconnected receipts.

**product_request_main:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`product_request`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | |
| warehouse_id | FK → MST-WH | where the goods are expected to land |
| supplier_id | FK → MST-SUP | required — this is a request *to* a specific vendor |
| request_date | date | when the request was raised |
| status | enum | `draft` / `sent` / `partially_received` / `received` / `cancelled` |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**product_request_item:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| product_request_main_id | FK → product_request_main | |
| product_id | FK → MST-PRD | |
| quantity_requested | integer | |
| quantity_received | integer, default 0 | updated automatically as Section 1 Inward documents reference this request — not manually edited |
| expected_unit_cost | decimal, nullable | |

**How receiving connects back:** when a Stock Inward document (Section 1) sets its `purchase_order_id` to this request, each of its items' `quantity_accepted` adds to the matching `product_request_item.quantity_received`. Once every item's `quantity_received` reaches its `quantity_requested`, `product_request_main.status` moves to `received` automatically; if some items are still short, it sits at `partially_received`. Cancelling a request (`status = cancelled`) doesn't touch anything already received — it just stops it from being fulfillable further.

**Direct receiving still works exactly as before** — Section 1's `purchase_order_id` is nullable specifically so a walk-in delivery with no prior request doesn't need one invented just to satisfy this section.

---

## Master change this document required (in step3.md)

**MST-REASON's category enum gains two values: `damage` and `stock_block`** (from Sections 2 and 3). Sections 4–11 above all reference masters that already exist — including `stock_adjustment`, which was already a category before this document started — so no further master change is needed for them.

**Every `_main` table now carries `document_number`, `financial_year_id`, and `store_id`.** MST-NUMSERIES's `series_type` was extended to cover all eleven of this document's document types, so each gets its own numbered sequence, scoped to financial year, consistently.

**Restructured into `_main`/`_item` pairs:** Sections 1–6 and 9 (Inward, Damage, Block, Transfer, Positive Adjustment, Opening, Negative Adjustment) each moved from one-row-per-product to a header with multiple product lines underneath — the same shape step5's Bill already used. Section 8 (Extension) and Section 10 (Correction) now reference specific `_item` rows via `source_item_type`/`source_item_id` rather than the old flat entities.

## Explicitly not in scope here

Sales/checkout, payments, voids, and shifts have since been defined in step5; stock ledger/balance logic is Section 7 above. Formal Purchase Orders — the one item that had been genuinely open — is now Section 13.
