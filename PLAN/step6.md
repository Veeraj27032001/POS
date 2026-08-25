# POS Application — step6: Reports

Companion to **step1–5.md**. This is a proposal, not final specs — a menu drawn from what's already been built, grouped by area. Confirm which ones matter and I'll detail each out (columns, grouping, exact filters) the same way the earlier documents were built section by section.

---

## Proposed Reports

### Stock & Inventory (step4)

| Report | What it shows |
|---|---|
| Current Stock | on_hand / available / expired, per product × warehouse — the live `/lib/stock` figures |
| Low Stock | every product at or below its `reorder_level` (step4 Section 11) |
| Inventory Valuation | on_hand quantity × `default_cost_price` (step3, MST-PRD), summed per warehouse or store — total stock value on the books |
| **Stock Ledger (Opening/Closing Balance)** | see full spec below |
| Stock Inward Register | all Inward documents, by supplier, by date |
| Stock Damage Register | write-offs over time, grouped by reason |
| Stock Transfer Register | transfers between warehouses/stores — pending, accepted, rejected, cancelled |
| Stock Adjustment Register | Positive + Negative Adjustments together — recount discrepancies |
| Stock Retest Register | every retest event — pass/fail split per item, and which failures converted into a Damage record |
| Product Request Register | every vendor request — requested vs. received quantity per item, and which are still `partially_received` |
| Expiry Report | expiring soon / expired-not-invalidated / already invalidated, per step4 Section 7 |
| Expiry Extension Audit | every extension made — who, when, from what date to what date |
| Stock Block Report | active blocks, especially stale ones past `review_by_date` |
| Entry Correction Audit | every data-entry fix made — what field, old vs new value |

### Stock Ledger (Opening/Closing Balance) — full spec

**What it's for:** every movement for a product × warehouse over a financial year, with an opening balance carried from the previous year and a closing balance that becomes *next* year's opening — the standard ledger shape.

**Filters:** Financial Year (required, single-select — MST-FY), Store, Warehouse, Product, Category.

**Header (per product × warehouse):**

```
opening_balance (for FY X) = /lib/stock's on_hand, computed using only movements dated
                              BEFORE FY X's start_date

closing_balance (for FY X) = /lib/stock's on_hand, computed using movements dated up to
                              and including FY X's end_date
                            = opening_balance + net movements dated WITHIN FY X
```

**Body:** every movement row within the selected FY — date, document type, document number, product, quantity in/out, running balance after that row — pulled from `stock_inward_item`, `stock_damage_item`, `stock_transfer_item`, `stock_positive_adjustment_item`, `stock_negative_adjustment_item`, `stock_opening_item`, and Bill Line Warehouse Allocation (sales), same sources step4 Section 7's formula already reads.

**Why 2027's opening automatically equals 2026's closing:** both numbers are the *same* `on_hand` computation, evaluated at the *same* date boundary — 2026's year-end is 2027's year-start. There's no separate carry-forward step, no new `stock_opening` record created every year, and no risk of the two figures drifting apart, because they're not two numbers kept in sync — they're one number read twice. This does mean `/lib/stock`'s function needs an optional "as of date" parameter (defaulting to now) rather than always computing the live figure — a small extension to the existing function, not a new one.

**Worked example** — one product × warehouse, FY 2027 (1 Apr 2027 – 31 Mar 2028):

| Date | Document Type | Document Number | Qty In | Qty Out | Running Balance |
|---|---|---|---|---|---|
| *(FY 2027 opens)* | — Opening = FY 2026's closing — | — | — | — | **100** |
| 05-Apr-2027 | Stock Inward | SI/2027-28/0012 | +10 | | 110 |
| 06-Apr-2027 | Sale (Bill) | CB/2027-28/0045 | | −1 | 109 |
| 12-Apr-2027 | Stock Damage | SD/2027-28/0003 | | −2 | 107 |
| ... | *(every movement in between)* | | | | ... |
| 31-Mar-2028 | *(FY 2027 closes)* | — | — | — | **whatever it lands on** |

That closing figure is exactly what FY 2028's row one would show as its opening — not copied over, just the same running total read again the moment the next year starts.

**What step4's `stock_opening_main`/`stock_opening_item` is still for:** only the very first balance, entered once when a warehouse goes live — the starting point before any ledger history exists. From the second financial year onward, opening balance is this report's computed view, not a new manually-entered record. If a past balance turns out to be wrong, that's corrected through step4's Entry Correction (Section 10) or a Positive/Negative Adjustment against the specific movement — never by creating a fresh opening entry to paper over it.

| Report | What it shows |
|---|---|
| Sales Register | every bill — number, date, customer, amount, type — the core GST sales record |
| Sales Summary | totals by day/week/month, by store, split Cash vs Credit |
| Product-wise Sales | which products sold, by quantity and revenue |
| Category-wise Sales | sales rolled up by MST-CAT |
| Customer-wise Sales | what each customer bought, how much, how often |
| Credit Bill Outstanding / Aging | who owes what, aged by `due_date` (current / 30 / 60 / 90+ days) |
| Payment Collection Report | payments received, by method — cash/UPI/card reconciliation |
| Refund Register | every refund issued, by reason, cancellation vs return |
| Bill Cancellation Register | cancelled bills, by reason, draft/held vs completed |
| Product Return Register | returns by product and reason |
| Credit Note Register | every Credit Note issued — the GST-compliance register |
| Discount Report | discounts applied, by reason, by staff member |
| Shift / Cash Reconciliation | opening float, expected vs counted, variance, per cashier per shift |

### Financial & Tax Compliance

| Report | What it shows |
|---|---|
| GST Summary | tax collected, broken down by HSN and tax component (CGST/SGST/IGST) — step3 Section 4's tax engine, rolled up, printed against the store's GSTIN (step3, MST-STORE) for filing |
| Financial Year Summary | totals for a selected financial year, across bills, credit notes, refunds |

### Staff & Operations

| Report | What it shows |
|---|---|
| Cashier/Staff Performance | sales value and bill count per staff member, per shift or period |
| Numbering Series Status | current number reached per series/store/financial year — an operational check, not a financial one |

---

## Filters — one shared pattern, not reinvented per report

**Common filter dimensions**, available wherever they're relevant to that specific report:
- Date range (always) — anchored to the financial year selector already in the header (step5, Section 2)
- Store — single store, or all stores if the user's role allows cross-store (step3, Sections 7/11/12's scoping rules apply here too)
- Warehouse
- Product / Category
- Customer
- Staff / Cashier / Terminal
- Payment method
- Status (whatever's relevant to that report — bill status, transfer status, block status, etc.)
- Bill type — Cash / Credit

**Built once, used everywhere:** same centralization discipline as `/lib/stock` and `/lib/credit` — filter logic (the query-building, not just the UI control) lives in one shared place, `/lib/reports/filters.ts` (step2, NJS-32), so every report pulls from the same filter set and the same store-scoping rules instead of each report hand-rolling its own. The filter *bar* itself is one shared frontend component, configured per report with only the dimensions that apply — a stock report doesn't show a "payment method" filter, a sales report doesn't show "warehouse."

---

## Master changes this document required (in step3.md)

None yet — reports read existing data, they don't introduce new masters. Worth confirming once individual reports are detailed: some (like GST Summary) may need saved-filter-preset storage, which would be a new small master if requested.
