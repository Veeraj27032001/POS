# POS Application — step9: Platform Admin Console (Vendor-Side)

**This is a different application from step1–8, not a module inside the POS.** step1–8 define the POS software a merchant runs. This document defines a separate, standalone app — used by you, the vendor — to manage every merchant who's licensed that POS. Its own database, entirely apart from any individual merchant's POS data (their MST-CUST, their bills, their stock — none of that lives here). The two systems only ever talk to each other over an API, the same relationship step7 already established for e-commerce.

**Naming note, to avoid confusion with step3's MST-CUST:** step3's "Customer" is a merchant's own shopper. What's described here as "customer" is the *merchant* — the business that licenses this POS from you. Referred to below as **Platform Customer** to keep the two unambiguous.

---

## 1. Platform Customer — PLAT-CUSTOMER

**What it's for:** one row per merchant business running an instance of this POS.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| business_name | string | |
| contact_email | string | |
| contact_phone | string | |
| status | enum | `active` / `degraded` / `suspended` |
| access_token | string, unique | issued to this merchant's POS instance, stored in *their* environment config |
| access_secret_hash | string | shown once at issuance, then only ever stored hashed — same pattern as step7's MST-APIKEY |
| disabled_modules | string[], nullable | which specific POS areas are switched off while `degraded` — e.g. `["ecommerce", "reports"]`. Empty/null while `active`; irrelevant while `suspended`, since suspension blocks everything |
| degraded_at | timestamp (UTC), nullable | |
| degraded_reason | text, nullable | |
| suspended_at | timestamp (UTC), nullable | |
| suspended_reason | text, nullable | |
| license_type | enum | `permanent` / `monthly` / `yearly` — how this merchant licensed the POS. Shown on their record in this console. |
| created_at | timestamp (UTC) | |

**Whether support is available at all is governed by Section 5's Support Plan, not a flag here** — see below.

**Three states, two different severities:**
- **`degraded`** — partial. Specific modules (`disabled_modules`) stop working; everything else keeps running. For a merchant who's, say, behind on payment for an add-on feature but should keep billing and stock running.
- **`suspended`** — total. Nothing in their POS works until reactivated. For non-payment on the core license, contract termination, etc.
- **`active`** — normal operation, no restriction.

## 2. Token Regeneration

**What it's for:** rotating a Platform Customer's credentials — lost secret, suspected compromise, or routine rotation.

Regenerating invalidates the old `access_token`/`access_secret` immediately and issues a new pair. The merchant's POS instance stops authenticating the moment the old token is invalidated — someone has to update their environment config with the new one before service resumes. This is a deliberate hard cutover, not a grace-period overlap, since the usual reason to regenerate is that the old credential shouldn't be trusted anymore.

## 3. POS-Side Middleware Check

**What it's for:** how a merchant's own POS instance (step1–8) actually enforces what this platform console decides.

Extends step1's BASE-RTE middleware with one more check, run alongside the existing RBAC check on every request:

1. The POS instance's `middleware.ts` reads its own `access_token`/`access_secret` from its environment config (never hardcoded, never committed).
2. On a schedule (not every single request — that would mean this platform console being a hard dependency for every page load) it calls this platform's status API for that token, caches the result briefly, and acts on it:
   - `suspended` → every request blocked, a dedicated message shown (same BASE-RTE-02 pattern as any other error page) rather than the app just silently failing.
   - `degraded` → requests to anything in `disabled_modules` blocked the same way; everything else works normally.
   - `active` → no effect, normal operation.

**This platform console being briefly unreachable doesn't take a merchant's POS down.** The cached status is used until the next check succeeds — a network blip on this system's side shouldn't cascade into every merchant's checkout counter going dark.

## 4. Platform Notifications — PLAT-NOTIFICATION

**What it's for:** you sending a message that shows up inside a merchant's own POS admin — a maintenance window, a new feature, a billing reminder — reusing the same "notification, not silent" philosophy as step7's customer notifications, aimed at merchants instead.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| target_type | enum | `all` / `specific` |
| target_customer_id | FK → PLAT-CUSTOMER, nullable | set only when `target_type = specific` |
| message | text | |
| sent_by_user_id | FK → (this console's own admin users) | |
| sent_at | timestamp (UTC) | |

**How it reaches the merchant's POS:** their POS instance polls this platform's notifications API for anything targeted at their `access_token` (or broadcast to `all`) and surfaces it as an admin-facing notification inside their own app — step8's Dashboard is the natural place for it to show up, alongside the widgets already there.

## 5. Support Plan — `PLAT-SUPPORT-PLAN`

**What it's for:** whether — and how well — a merchant is entitled to support, as its own record rather than a flag, since it needs a tier, a billing cycle, and a validity window, not just yes/no.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| platform_customer_id | FK → PLAT-CUSTOMER | |
| tier | enum | `basic` / `premium` |
| billing_cycle | enum | `monthly` / `yearly` — same shape as `license_type`, but support is purchased separately from the base license |
| response_sla_hours | integer, nullable | target first-response time — e.g. 24 for `basic`, 4 for `premium` |
| start_date | date | |
| end_date | date, nullable | null while ongoing/auto-renewing |
| status | enum | `active` / `expired` / `cancelled` |
| created_at | timestamp (UTC) | |

**A merchant has support available right now if and only if** a `PLAT-SUPPORT-PLAN` row exists for them with `status = active` and (`end_date` is null or hasn't passed). No separate boolean to keep in sync — this is the single source of truth for "do they have support."

## 6. Support Tickets — `PLAT-SUPPORT-TICKET` / `PLAT-SUPPORT-REPLY`

**What it's for:** a merchant raising a support issue from inside their own POS, and you answering it from this console — the same API relationship as everything else in this document, just flowing the other direction (merchant → vendor, instead of vendor → merchant).

**Gated by Section 5:** creating a ticket first checks the merchant has an active Support Plan. No active plan → the **Raise Support Request** action is blocked, with a message pointing at purchasing one — not hidden without explanation, and not silently allowed through either.

**PLAT-SUPPORT-TICKET:**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| platform_customer_id | FK → PLAT-CUSTOMER | identified by the merchant's own `access_token` on the request — no separate login needed to raise one |
| support_plan_id | FK → PLAT-SUPPORT-PLAN | which active plan covered this ticket at the time it was raised — kept even if the plan later expires, so history stays accurate |
| raised_by_name | string | contact name/email at the merchant, since this console doesn't have visibility into their internal POS users |
| subject | string | |
| description | text | |
| status | enum | `open` / `in_progress` / `resolved` / `closed` |
| priority | enum | `low` / `medium` / `high` |
| created_at | timestamp (UTC) | |

**PLAT-SUPPORT-REPLY (threaded):**

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| ticket_id | FK → PLAT-SUPPORT-TICKET | |
| replied_by | enum | `merchant` / `vendor_admin` |
| replied_by_name | string | |
| message | text | |
| created_at | timestamp (UTC) | |

**On the POS side:** a **Raise Support Request** action inside the merchant's own app (a natural fit alongside step8's Dashboard) — submits a new ticket via this console's API, and shows the merchant their own ticket history and any replies, using the same polling pattern Section 4's notifications already use.

**On this console's side:** a ticket queue — list, filter by customer/status/priority, open a thread, reply, change status. Nothing about a ticket's status changes automatically; closing one is a deliberate action, same "visible, not automatic" discipline as the POS side's stale-blocks and stale-held-bills lists.

## 7. Platform Invoicing — `PLAT-INVOICE`

**What it's for:** actually billing a merchant for what Section 1's `license_type` and Section 5's Support Plan say they're on — those record *what* a merchant is entitled to; this is what turns that into an actual invoice.

| Field | Type | Notes |
|---|---|---|
| id | opaque token | |
| platform_customer_id | FK → PLAT-CUSTOMER | |
| invoice_type | enum | `license` / `support` — billed separately, since a merchant can have one without the other |
| amount | decimal | |
| billing_period_start | date, nullable | null for a `permanent` license's one-time invoice |
| billing_period_end | date, nullable | null for a `permanent` license's one-time invoice |
| due_date | date | |
| status | enum | `pending` / `paid` / `overdue` / `cancelled` |
| paid_at | timestamp (UTC), nullable | |
| created_at | timestamp (UTC) | |

**Generation:**
- `permanent` license → one `license`-type invoice, once, at signup. No recurring generation.
- `monthly` / `yearly` license → a new `license`-type invoice generated automatically at the start of each cycle, using `PLAT-CUSTOMER.license_type` to set the cadence.
- An active Support Plan (Section 5) generates its own `support`-type invoices the same way, on *its* `billing_cycle` — independently of the license cycle, since a merchant could be yearly on one and monthly on the other.

**Overdue invoices don't auto-suspend anything.** Same "visible, not automatic" rule as everywhere else in this system — an `overdue` invoice shows up on an Overdue Invoices list in this console; degrading or suspending that merchant (Section 1) is still a deliberate, separate action, not something this table triggers on its own.

---

## Master changes this document required

None in step3.md — this is a separate application with its own data model (PLAT-CUSTOMER, PLAT-NOTIFICATION), not an extension of the POS's masters. The only change to the POS side itself is the middleware extension in Section 3 above, which is a step1/BASE-RTE behavior addition, not a new master.

## Explicitly not in scope here

Billing/subscription management for the Platform Customers themselves (i.e., how *you* invoice merchants for using this POS) — that's a distinct requirement from access control and hasn't been given yet.
