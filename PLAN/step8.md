# POS Application — step8: Dashboard / Home Screen

Companion to **step1–7.md**. The landing screen after login — brings together everything already built as "surfaced, but you have to go look" lists into one place, so nothing gets missed just because nobody remembered to check a page.

Store-scoped like everything else: an operational user sees their own store's widgets; an Admin gets a store switcher, same as everywhere else in this system (step3, Sections 7/11/12).

---

## Widgets

| Widget | Source | Shows |
|---|---|---|
| Today's Sales Summary | step5, Bill | revenue and bill count today, split by `bill_type` (Cash/Credit/Online) |
| Low Stock Alerts | step4, Section 11 | count + quick list of products at/below `reorder_level`, links through to the full report |
| Stale Stock Blocks | step4, Section 3 | active blocks past their `review_by_date`, same list as the Stale Blocks page |
| Stale Held Bills | step5, Section 11 | `held` bills older than the configured threshold |
| Pending Transfers | step4, Section 4 | incoming requests (this store as destination, awaiting response) and outgoing ones (this store as source, awaiting the other side) |
| Credit Bill Outstanding | step5, Section 13 | total outstanding across this store's customers, computed the same way that section already defines |
| Platform Notifications | step9, Section 4 | messages sent from the vendor's Platform Admin Console — broadcast or targeted at this merchant specifically |
| Support Tickets | step9, Sections 5–6 | this merchant's own raised tickets and any replies, plus the **Raise Support Request** action — only usable with an active Support Plan; shows a purchase prompt otherwise |

**Nothing new is computed here.** Every widget is a thin view over a calculation or list that already exists elsewhere in the spec — the dashboard's job is surfacing them together, not introducing a new source of truth. A widget count going up is a reason to click through to the underlying page, not a number this screen owns itself.

---

## Master changes this document required (in step3.md)

None — every widget reads existing data through mechanisms already defined (`/lib/stock`, `/lib/credit`, the stale-blocks and stale-held-bills rules, Bill's own fields). Nothing new to store.
