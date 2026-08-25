# POS Application — step5: Billing

Companion to **step1.md** (technical base), **step2.md** (Next.js setup), **step3.md** (masters), and **step4.md** (stock management).

**Scope of this document so far — exactly what's been specified, more to come:**
1. Bill types — Cash Bill and Credit Bill
2. Numbering Series management page (step3, MST-NUMSERIES)
3. Financial Year selection at login (step3, MST-FY)
4. Financial Year switchable from the header
5. Every bill drawn from its type's numbering series, scoped to the active financial year
6. Customer selection at billing — existing lookup or inline auto-create on first entry
7. Payment collection via QR code or payment link, including partial-amount requests against Credit Bill balances
8. Scan to add product — barcode scan or manual search, no special hardware integration needed
9. Refund tracking — shared between cancellation and return
10. Bill Cancellation — Cash or Credit, whole bill
11. Product Return — partial, specific lines only, not the whole bill
11. The Bill itself — header, line items, mid-bill line removal, hold/park, print trigger
12. Bill Payment — split payment across multiple methods
13. Credit Bill outstanding balance — computed, not a separate stored ledger
14. Credit Note — the GST-required document generated automatically on every Product Return
15. Shift — cash reconciliation, finally using step3's MST-DENOM
16. Multi-warehouse allocation per bill line — a store's own multiple warehouses can jointly fulfill one line
17. Store GSTIN (step3, MST-STORE) and stale-held-bill handling

Stock deduction on sale and oversell prevention are now wired into step4 Section 7 and this document's Section 7, both routed through one shared calculation function (step2, NJS-32).

---

## 1. Financial Year at Login

On login, the user selects (or is defaulted to) the current financial year — MST-FY — for their session. Whatever's active gets tagged onto any transaction created during that session, including which numbering series a new bill draws from.

## 2. Financial Year Switcher (header)

A financial year selector lives in the app header, letting the user switch their active financial year at any point during the session, not just at login. Switching changes which MST-NUMSERIES row any *new* bill draws its number from — it doesn't touch bills already created under the previous selection.

## 3. Bill Numbering

Each bill — Cash or Credit — draws its number from the MST-NUMSERIES row matching its bill type, the acting store, and the currently active financial year:

```
{prefix} / {financial_year.label} / {current_number}
e.g.  CB / 2025-26 / 0001
```

`current_number` on that series increments by 1 with every bill created against it.

## 4. Numbering Series Management (page)

A dedicated page (step3, MST-NUMSERIES) where an Admin maintains series per store — creating a new one for a new financial year, setting its prefix, and viewing its current number. This covers all 18 document types that draw a number this way, not just the two bill types — every stock document (step4), every billing document (this file), and Shift all get their own fully separate series here, matching MST-NUMSERIES's design — none of them ever share a sequence with another.

## 5. Customer Selection at Billing

**What it's for:** attaching a customer to a bill — required for Credit Bill, optional for Cash Bill (step3, MST-CUST) — without forcing a separate trip to a customer master screen.

**Behavior:**
- Search existing customers, same lookup pattern step3 already notes — typically by phone, or by name.
- Or type a new customer's details directly into that same field. If nothing matches, a new MST-CUST record is created automatically on that first entry — at minimum name, plus whatever else was entered (phone, etc.) — and attaches straight to the bill being billed. No separate save step, no detour to a customer master screen.

**Credit check on Credit Bill:** MST-CUST.credit_limit is nullable — a null limit is treated as *unlimited* credit, not zero and not blocked. This matters most for a customer created inline moments ago on their first Credit Bill: they bill normally with no limit enforced until an Admin later sets an actual credit_limit on their record, at which point the check becomes real.

## 6. Payment Collection — QR Code, Payment Link & Card Machine

**What it's for:** collecting payment digitally — a QR code shown at the terminal, a payment link sent to the customer's phone, or a physical card/UPI payment terminal ("card machine") connected to the counter. Used both to settle a bill at billing time, and to collect payment later against an outstanding Credit Bill balance — same mechanism either way.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| bill_id | FK → TXN-BILL | which bill this applies to |
| document_number | string | drawn from MST-NUMSERIES (series_type=`payment_request`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this record was created |
| store_id | FK → MST-STORE | derived from the bill's store, stored directly |
| amount | decimal | the amount being requested for **this** payment — not necessarily the full amount due. Partial payment is explicitly supported: this reflects however much the customer says they're willing to pay right now, not always the full outstanding balance |
| method | enum | `qr_code` / `payment_link` / `card_machine` |
| delivery_channel | enum, nullable | applies to `payment_link` only — `email` / `sms`. `qr_code` and `card_machine` are always at the terminal, never sent anywhere |
| status | enum | `pending` / `paid` / `expired` / `cancelled` |
| gateway_reference | string, nullable | the payment gateway's own transaction reference, once paid |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |
| paid_at | timestamp (UTC), nullable | |

**Card machine, specifically:** a physical card/UPI payment terminal connected to the counter — customer taps, swipes, inserts a card, or scans the *device's own* UPI QR. Integrated the same way step2's NJS-23 already connects a receipt printer or cash drawer: through the Electron main process, using Razorpay's own POS terminal hardware and SDK (Razorpay's already the chosen gateway, per NJS-35) — no second payment integration to build. The terminal handles the actual card-present transaction; the result (success/failure + `gateway_reference`) comes back the same way a `qr_code` or `payment_link` result does, updating this same table.

**Two situations, same mechanism:**
1. **At billing time** — an alternative to physical cash: show the QR on-screen, tap/swipe/insert on the card machine, or send a link — customer pays, status flips to `paid` once the gateway confirms it, and billing proceeds. `card_machine` only applies here; the customer has to be physically at the counter for it.
2. **Against an outstanding Credit Bill, later** — a separate request, created whenever staff choose to follow up on a balance, for whatever amount the customer's agreed to pay right then. Sent as a link (email/SMS) since the customer isn't standing at the terminal for this one.

**What this doesn't cover yet:** ~~nothing left here~~ — Section 13 resolves this. A payment request against a Credit Bill reads Section 13's `outstanding_balance` to know what's actually still owed before generating the QR/link, and once `paid`, the new Bill Payment row (Section 12) feeds straight back into that same formula on its next read — no separate reconciliation step needed.

## 7. Scan to Add Product

**What it's for:** the core billing action — getting a product onto the bill, by scanner or by typing.

**Why no special scanner integration is needed:** almost every USB/Bluetooth barcode scanner is a HID device — it emulates a keyboard. It types the barcode number wherever the cursor is focused, then sends Enter. Scanning is a UI pattern here, not a hardware integration (unlike the receipt printer/cash drawer in step2's NJS-23, which do need the Electron bridge).

**The flow:**
1. One always-focused input on the billing screen — a search/scan box that auto-refocuses after every action, so the cashier never has to click into it. The scanner's keystrokes land there regardless of what else is happening on screen.
2. On Enter, exact-match lookup against `Product.sku/barcode` **or** `Product.system_barcode` (step3) — both indexed, either one resolves the same product. Since "Maggi 10rs Pack" and "Maggi 20rs Pack" are separate Product records with their own barcodes, scanning either one can only ever resolve to that specific product — never the other pack size.
3. **Match found** → that product is added to the bill, or incremented by 1 if it's already on there. A short beep/visual flash confirms it; input clears and stays focused for the next scan. Price and tax shown are live (BASE-DTR, NJS-22) — never a cached figure.
4. **No match** → an inline error, without interrupting the flow — input stays focused, cashier can immediately rescan or search manually.
5. **Same input doubles as manual search-by-name**, a typeahead fallback for a damaged or missing barcode. Typing "Maggi" surfaces both the 10rs and 20rs pack as separate, individually selectable products — no ambiguity about which one gets added.
6. **Quantity** defaults to +1 per scan — scanning the same item 3 times gives quantity 3 on that line — with a manual override on the line for bulk entry without scanning three times.
7. **Oversell prevention:** if the product's `stock_tracked` is true, adding a quantity that would exceed `available` (step4 Section 7's figure, via the single shared `/lib/stock` function — never re-checked with separate logic here) is blocked with an inline message. Live means live, same as everywhere else in this base: checked against the real number at the moment of adding, not a cached count.
8. **Warehouse selection, when the store has more than one:** `available` for oversell prevention is checked per-warehouse, summed across the store's warehouses to decide if the line can be added at all. If it needs more than one warehouse's stock to cover the quantity, the cashier chooses the split — which warehouse(s), how much from each — filling in Section 11's Bill Line Warehouse Allocation. With only one warehouse in the store, this is invisible: the whole quantity allocates there automatically, no extra step for the cashier.

## 8. Refund — TXN-REFUND

**What it's for:** shared tracking for money going back to the customer, whichever of Sections 9/10 below caused it — one mechanism, not duplicated per case.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| source_type | enum | `bill_cancellation` / `bill_return` — which of the two below caused this refund |
| source_id | FK (polymorphic) | the specific cancellation or return record |
| document_number | string | drawn from MST-NUMSERIES (series_type=`refund`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this record was created |
| store_id | FK → MST-STORE | derived from the original bill's store, stored directly |
| amount | decimal | |
| refund_method_id | FK → MST-PAY, nullable | can differ from the original payment method |
| status | enum | `pending` / `processing` / `completed` / `failed` — `processing` reflects that a gateway refund takes time to settle; see step7 for what triggers a customer notification on each change |
| gateway_reference | string, nullable | |
| processed_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |
| completed_at | timestamp (UTC), nullable | |

## 9. Bill Cancellation — TXN-BILL-CANCELLATION

**What it's for:** cancelling an entire bill — Cash or Credit alike, at any status: `draft`, `held`, or `completed`.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| bill_id | FK → TXN-BILL | |
| bill_status_at_cancellation | enum | `draft` / `held` / `completed` — snapshot of what the bill was before this cancellation, since the effects differ |
| document_number | string | drawn from MST-NUMSERIES (series_type=`bill_cancellation`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this record was created |
| store_id | FK → MST-STORE | derived from the bill's store, stored directly |
| reason_code_id | FK → MST-REASON (category=`void`) | reuses the existing `void` category — no new master change needed |
| cancelled_by_user_id | FK → MST-USER | |
| cancelled_at | timestamp (UTC) | |

**If the bill was `draft` or `held`:** a true void — no money changed hands, no stock was ever permanently deducted (only reserved via Section 11's per-line blocks, per the note above). Cancelling releases those blocks and that's the whole effect.

**If the bill was `completed`:** functionally a 100% return, so it's treated like one for compliance. Two things happen together:
1. **Refund** — a Section 8 Refund is created (`source_type = bill_cancellation`) for the full amount paid.
2. **Credit Note** — Section 10's Credit Note is generated for the full bill, same as a full Product Return would produce, since GST treatment shouldn't differ just because the reversal is called "cancellation" instead of "return."

Stock reflects this automatically, not through a separate reversal entry: step4 Section 7's formula only subtracts Bill Lines where the parent Bill's status is `completed` — the moment this bill's status changes away from `completed`, its lines stop counting as sold and the quantity is available again, purely because the total is computed fresh each time rather than stored.

## 10. Product Return — TXN-BILL-RETURN

**What it's for:** returning specific items from a bill — explicitly partial. Not every line on a bill has to come back; a customer might return one product and keep the rest.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| bill_id | FK → TXN-BILL | |
| reason_code_id | FK → MST-REASON (category=`return`) | already an existing category |
| document_number | string | drawn from MST-NUMSERIES (series_type=`bill_return`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this record was created |
| store_id | FK → MST-STORE | derived from the bill's store, stored directly |
| processed_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

**Return Line:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| return_id | FK → TXN-BILL-RETURN | |
| bill_line_id | FK → TXN-BILL-LINE | which specific line this returns against |
| quantity | integer | can't exceed that line's quantity minus anything already returned against it |
| condition | enum | `sellable` / `damaged` — same distinction step4 already uses for stock returns |
| warehouse_id | FK → MST-WH | which warehouse the returned stock goes back into (or is written off at, if damaged) — staff selects this; it doesn't have to be the same warehouse the original sale drew from |

**This is the fix for the long-open "returns don't restock" gap** — both outcomes now have a real effect on stock, through mechanisms that already exist rather than new ones:

- **`sellable`** → adds directly to `on_hand` at `warehouse_id`. step4 Section 7's formula gains one more additive term: `+ Return Line.quantity` (this warehouse, `condition = sellable`).
- **`damaged`** → doesn't touch `on_hand` directly. Instead it auto-creates a `stock_damage_main`/`stock_damage_item` (step4, Section 2) for that quantity, with a pre-seeded reason ("Returned damaged"), linked back the same way a failed Retest (step4, Section 12) links to its Damage record. The deduction — if there ever were one to make, though a damaged return was never re-added to `on_hand` in the first place — happens through that existing Damage path, not a second one.

**Refund:** the returned portion's value creates a Section 8 Refund with `source_type = bill_return`.

**Credit Note:** every Product Return generates one automatically — the GST-required formal document, distinct from the internal return record above. Section 9's completed-bill Cancellation also generates one, for the same reason (see there).

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`credit_note`), scoped to store + active financial year — same mechanism as bill numbering (Section 3) |
| financial_year_id | FK → MST-FY | |
| store_id | FK → MST-STORE | derived from the original bill's store, stored directly |
| source_type | enum | `bill_return` / `bill_cancellation` — which of the two caused this |
| source_id | FK, polymorphic | the specific TXN-BILL-RETURN or TXN-BILL-CANCELLATION record |
| original_bill_id | FK → TXN-BILL | the invoice being adjusted |
| customer_id | FK → MST-CUST | derived from the original bill, kept directly on the document itself |
| amount | decimal | matches the returned/cancelled portion's refund value |
| tax_breakdown | JSON | the tax being reversed on the returned/cancelled lines — a Credit Note has to show this adjustment, not just the amount |
| created_by_user_id | FK → MST-USER | |
| created_at | timestamp (UTC) | |

## 11. The Bill — TXN-BILL / TXN-BILL-LINE

**What it's for:** the entity everything else in this document has been referencing as "pending" — the bill header and its line items.

**Bill (header):**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| document_number | string | drawn from MST-NUMSERIES per Section 3's format |
| financial_year_id | FK → MST-FY | |
| bill_type | enum | `cash_bill` / `credit_bill` / `online_bill` |
| store_id | FK → MST-STORE | |
| terminal_id | FK → MST-TERM | |
| cashier_user_id | FK → MST-USER | |
| customer_id | FK → MST-CUST, nullable | null only allowed for `cash_bill` — required for `credit_bill` (Section 5) and `online_bill` (step7) alike |
| status | enum | `draft` / `held` / `completed` / `cancelled` |
| subtotal | decimal | sum of active line totals, before discount/tax |
| discount_total | decimal | |
| tax_total | decimal | |
| grand_total | decimal | |
| due_date | date, nullable | Credit Bill only |
| receipt_snapshot | JSON | store logo/header/footer/return-policy, captured at completion — step3 Section 7's fidelity rule: a reprint later always shows this snapshot, never a live lookup |
| held_at | timestamp (UTC), nullable | set when status moves to `held` |
| resumed_at | timestamp (UTC), nullable | set when a held bill is picked back up |
| shift_id | FK → TXN-SHIFT, nullable | which cashier shift this bill falls under — see Section 14 |
| created_at | timestamp (UTC) | |
| completed_at | timestamp (UTC), nullable | |

**Bill Line:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| bill_id | FK → TXN-BILL | |
| product_id | FK → MST-PRD | added via Section 7's scan/search flow |
| quantity | integer | the line's total quantity — may be drawn from more than one warehouse, see the allocation table below |
| unit_price | decimal | snapshotted at the moment the line was added |
| tax_breakdown | JSON | snapshotted per step3 Section 4's tax engine resolution |
| discount_applied | decimal, nullable | |
| discount_reason_code_id | FK → MST-REASON (category=`discount`), nullable | required if discount_applied is non-zero |
| line_total | decimal | |
| status | enum | `active` / `voided` |
| voided_by_user_id | FK → MST-USER, nullable | |
| voided_at | timestamp (UTC), nullable | |

**Bill Line Warehouse Allocation — TXN-BILL-LINE-WAREHOUSE:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| bill_line_id | FK → TXN-BILL-LINE | |
| warehouse_id | FK → MST-WH | must belong to the bill's store — this doesn't cross stores, only warehouses within the one store the bill is for |
| quantity | integer | how much of the line's total `quantity` is drawn from this specific warehouse |

**Why a line can split across warehouses:** a store commonly has more than one warehouse (step3, MST-WH), and a single product's stock might be spread across them — e.g. 5 units in Warehouse 1, 6 in Warehouse 2, but the customer wants 10. One Bill Line still shows "Product × 10" to the customer; underneath, the cashier chooses how those 10 are actually drawn — 5 from W1 and 5 from W2, or any other split — via this allocation table. The rows here must sum to the line's `quantity`. This is what step4 Section 7's stock formula now reads from, warehouse by warehouse, rather than assuming a line maps to a single warehouse.

**Reserving stock while the bill is still in progress:** adding an allocation row creates a step4 Section 3 Stock Block for that quantity (`source_type = draft_bill_line`, `source_id` = the allocation row) — this is what closes the race condition where two terminals could otherwise both add the last unit to two different draft bills at once. The block releases automatically, no manual staff action, in exactly three cases: the line is voided (below), the bill is cancelled (Section 9), or the bill completes — at which point the permanent deduction in step4 Section 7's formula takes over and the temporary block is no longer needed.

**Mid-bill line removal:** un-scanning a mis-added item, while the bill is still `draft`, sets that line's status to `voided` rather than deleting the row — it drops out of the totals but the trace stays. No reason code required here, unlike Section 10's Return — this is correcting an in-progress bill, not reversing a completed one. Only lines on a `draft` bill can be voided this way; once `completed`, removing an item is a Section 10 Return instead.

**Hold/Park:** a cashier can set status to `held` at any point before payment, to serve another customer — `held_at` is stamped, lines and customer stay exactly as they were. Resuming picks it from a Held Bills list, status returns to `draft`, `resumed_at` is stamped, and billing continues from where it left off.

**Stale held bills — same philosophy as step4's Stock Block:** visible, never automatic. A held bill doesn't auto-cancel just because time passed — that would silently drop a customer's in-progress order with no human decision behind it. Instead, any `held` bill older than a configurable threshold shows up in a Stale Held Bills list, the same pattern as step4's stale-blocks list, where staff decide to resume it or cancel it (Section 9).

**Print receipt:** once status becomes `completed`, printing is triggered using `receipt_snapshot` — routed through step2's NJS-23 Electron bridge (`window.hardware.print(receipt)`) to the terminal's bound printer.

## 12. Bill Payment — TXN-BILL-PAYMENT (Split Payment)

**What it's for:** one payment applied to a bill — a bill can have more than one, split across methods (e.g. part cash, part UPI via Section 6's QR).

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| bill_id | FK → TXN-BILL | |
| payment_method_id | FK → MST-PAY | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`bill_payment`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this record was created |
| store_id | FK → MST-STORE | derived from the bill's store, stored directly |
| amount | decimal | |
| reference_number | string, nullable | required if MST-PAY.requires_reference is true |
| status | enum | `success` / `failed` / `pending` |
| created_at | timestamp (UTC) | |

**Rule:** a bill can only move to `completed` once its `success` TXN-BILL-PAYMENT rows sum to at least `grand_total`. A Section 6 request, once it reaches `paid`, creates one of these rows automatically — Section 6 is one way a payment gets into this table, not a separate parallel system. `payment_method_id` is set based on which Section 6 `method` collected it: `qr_code` and `payment_link` map to the store's MST-PAY row of type `upi`, `card_machine` maps to the MST-PAY row of type `card` — each store needs both configured in its Payment Method list (step3, Section 9) for this mapping to resolve.

## 13. Credit Bill Outstanding Balance

**What it's for:** how much a customer owes, across every Credit Bill they have — not tracked as a separate stored ledger, computed the same way step4 handles stock: one formula, one shared function, every consumer calls it.

```
outstanding_balance (per customer) =

  SUM over all TXN-BILL where customer_id = X, bill_type = 'credit_bill', status = 'completed'
    of  ( grand_total
          − SUM of Credit Notes (Section 10) where original_bill_id = this bill
          − SUM of that bill's 'success' TXN-BILL-PAYMENT.amount )
```

No new table — this reuses TXN-BILL, TXN-BILL-PAYMENT (Sections 11–12), and Section 10's Credit Note, all of which already exist. A return against a credit purchase genuinely reduces what's owed — the formula has to reflect that, not just track payments against the original total. Section 6's payment collection, when creating a request against an existing balance, reads this figure to know what's actually still owed before generating the QR/link.

**Same centralization rule as stock:** this calculation lives in exactly one place — `/lib/credit/getOutstandingBalance.ts` (step2, NJS-32) — not reimplemented anywhere it's needed (the credit check at billing, a customer statement screen, a collections list). One function, called everywhere, changed once if the rule ever changes.

**Credit limit check, now made concrete:** Section 5 already said a null `credit_limit` means unlimited credit. With this formula in place, a non-null limit check is: does `outstanding_balance + this new bill's grand_total` stay at or under `MST-CUST.credit_limit`? If not, the Credit Bill is blocked at completion, not silently allowed over.

## 14. Shift — TXN-SHIFT / TXN-SHIFT-CASH

**What it's for:** a cashier's session on a terminal, from opening cash float to closing count — what step3's `MST-DENOM` (Cash Denominations) was defined for but nothing has used until now.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| terminal_id | FK → MST-TERM | |
| cashier_user_id | FK → MST-USER | |
| store_id | FK → MST-STORE | |
| document_number | string | drawn from MST-NUMSERIES (series_type=`shift`), scoped to store + active financial year |
| financial_year_id | FK → MST-FY | the financial year active when this shift was opened |
| status | enum | `open` / `closed` |
| opening_float | decimal | starting cash amount |
| closing_expected | decimal, nullable | computed: opening_float + cash sales − cash refunds during the shift |
| closing_counted | decimal, nullable | entered by the cashier at close |
| variance | decimal, nullable | closing_counted − closing_expected |
| opened_at | timestamp (UTC), nullable | |
| closed_at | timestamp (UTC), nullable | |

**Shift Cash Count — TXN-SHIFT-CASH:**

| Field | Type | Notes |
|---|---|---|
| shift_id | FK → TXN-SHIFT | |
| denomination_id | FK → MST-DENOM | |
| count_type | enum | `opening` / `closing` |
| quantity_counted | integer | |

**How this ties to billing:** every Bill (Section 11) carries a `shift_id`. `closing_expected` sums the shift's cash-method TXN-BILL-PAYMENT amounts (Section 12) directly, rather than re-deriving it from the whole day's transactions — same "compute from what already exists, don't duplicate a running total" discipline as stock and the credit balance.

---

## Master changes this document required (in step3.md)

Two new masters were added: **MST-FY** (Financial Year) and **MST-NUMSERIES** (Numbering Series) — Sections 1–3 above both reference a financial year and a per-type running number, and neither existed in step3 before now. MST-NUMSERIES's `series_type` also covers `stock_inward` and `expiry_extension`, so step4's Sections 1 and 8 draw their own document numbers the same way a bill does — not just the two bill types.

Sections 8–10 (Refund, Cancellation, Return) needed no further master change — `void` and `return` were already existing MST-REASON categories from step3/step4, reused here rather than duplicated.

Sections 11–12 (Bill, Bill Payment) needed no further master change either — both reference MST-STORE, MST-TERM, MST-USER, MST-CUST, MST-PRD, MST-REASON, and MST-PAY, all of which already exist.

Section 13 (Credit Bill Outstanding Balance) needed no master change at all — it's a computed formula over Sections 11–12, not a new table.

Section 10's new Credit Note needed one addition: MST-NUMSERIES's `series_type` now also covers `credit_note`, same pattern as the bill types and step4's stock document numbers.

Section 11's Bill Line Warehouse Allocation needed no new master — it references MST-WH, which already exists. Section 14's Shift needed no new master either — it's the first thing to actually use MST-DENOM, which existed since the masters phase but was unused until now.

**MST-STORE gained one field: `gstin`** — needed to print a legally valid GST invoice, and didn't exist on the store record before now.

Two structural fixes landed in step4.md rather than step3.md: Stock Block (Section 3) gained `source_type`/`source_id` so a block can be traced back to whatever auto-created it (a pending Transfer, or now a draft Bill Line) and released by that same trigger without a manual staff action. Credit Note's origin became polymorphic (`bill_return` / `bill_cancellation`) rather than only ever coming from a Return, since a cancelled completed bill now generates one too.

**Every entity in this document now carries `document_number`, `financial_year_id`, and `store_id`** — not just Bill and Credit Note, which had them already. MST-NUMSERIES's `series_type` was extended to cover Payment Collection, Refund, Bill Cancellation, Product Return, Bill Payment, and Shift too, so each gets its own numbered sequence, consistently, the same way a bill does.

## Explicitly not in scope here

**Payment gateway: Razorpay.** Section 6's QR/Link generation, and Section 12's Bill Payment reconciliation, are implemented against Razorpay's API — `gateway_reference` (Sections 6, 8, 12) is Razorpay's own transaction ID. Everything else this document originally deferred (the Bill entity, Credit Bill's outstanding balance, stock deduction, oversell prevention) has since been resolved in Sections 11–14.
