# Client Application — Technical Base

Reusable technical foundation, carried over as-is from the ERP platform's own cross-cutting standards (ERP Platform Master Plan, Section 5) since these are generic engineering patterns, not ERP-specific. This is the base layer only — application-specific architecture (modules, routes, data model) is not yet defined, pending scope.

---

## 1. Data Loading, Table Rendering & Progressive Pagination

The same record-count-first, chunked-loading pattern, plus app-wide loading UX:

| ID | Requirement |
|---|---|
| **BASE-DTR-01** | On first load, request `totalRecords`/`totalPages` only — no row data yet. |
| **BASE-DTR-02** | Render a full skeleton table and correctly-sized pagination immediately from that count, before any row arrives. |
| **BASE-DTR-03** | Fetch one page (chunk) at a time — never the full dataset in one call. |
| **BASE-DTR-04** | Changing page size sends current page + new size, discards cached pages, re-renders skeleton against the recalculated page count. |
| **BASE-DTR-05** | Clicking any page fetches immediately, even if an earlier page's request is still in flight — never queued. |
| **BASE-DTR-06** | Cancel stale requests (`AbortController`) when navigating away before a page's data arrives. |
| **BASE-DTR-07** | Fill-in is page-scoped — only the active page's rows replace skeleton on arrival, independent of any other page's load state. |
| **BASE-DTR-08** | Cache loaded pages for the session — revisiting via client-side navigation doesn't re-fetch. This cache lives only in memory for the current app runtime: a full page reload (hard refresh) always clears it, and the page starts fresh with a new count-first request — never persisted across reloads via localStorage/sessionStorage. |
| **BASE-DTR-09** | Cache is keyed by full query state (page, page size, sort, filters, search) — not page number alone. Changing any of these invalidates the cache and triggers a fresh count-first request. |
| **BASE-DTR-10** | A failed page fetch renders a page-scoped failed state with inline retry — never a full-table error, never stuck as skeleton indefinitely. One bounded automatic retry with backoff before falling to manual retry. |
| **BASE-DTR-11** | Each cached page carries a TTL; on expiry, serve stale immediately while refetching in the background. Any write (create/update/delete) by the current user against the same resource invalidates that resource's entire cache immediately, regardless of TTL. |
| **BASE-DTR-12** | If the current page exceeds the recalculated total after invalidation (e.g. deletions), clamp to the last valid page rather than rendering empty/out-of-range. |
| **BASE-DTR-13** | Skeleton loading applies to every page/view that fetches data on load, not just data tables — no blank screens while waiting on the initial request. |
| **BASE-DTR-14** | For loads that risk feeling slow, show a progress-bar-style indicator with incrementing (illusionary) progress rather than a static spinner — improves perceived speed even when actual load time is unchanged. |

**Contract**, unchanged:
```
Request:  GET /api/{resource}?page={n}&pageSize={m}
Response: { totalRecords, totalPages, page, pageSize, data: [...] }
```

## 2. Date & Time Handling

| ID | Requirement |
|---|---|
| **BASE-DTH-01** | Store every date/timestamp in UTC, regardless of the viewing user's timezone. |
| **BASE-DTH-02** | Convert every displayed date/timestamp to the user's own timezone (falling back to an organization or application default) — never show raw UTC or server-local time. |
| **BASE-DTH-03** | Date display format (DD/MM/YYYY vs. MM/DD/YYYY, 12h vs. 24h) is configurable, not hardcoded. |
| **BASE-DTH-04** | A timestamp within a configurable recent window may show relatively ("3 hours ago"), with the absolute value always available on hover; anything older shows the absolute date always. |
| **BASE-DTH-05** | A field defined as date-only stores and displays with no time component — this is the one that actually causes bugs, since a date-only value passed through a timezone conversion can silently shift to the wrong calendar day. |

## 3. Security & Data Standards

| ID | Requirement |
|---|---|
| **BASE-SEC-01** | No internal database ID is ever exposed to or accepted from the client — every reference in a URL or payload is an opaque token. |
| **BASE-SEC-02** | Encryption at rest and in transit for all data. |
| **BASE-SEC-03** | Defense-in-depth: MFA, RBAC, full audit logging, daily backups. |

## 4. Routing, Middleware & Error Handling

| ID | Requirement |
|---|---|
| **BASE-RTE-01** | Route access control is enforced via Next.js middleware: a single root `middleware.ts` entry point, with the actual guard/permission logic organized under a `middleware/` folder (e.g. `middleware/auth.ts`, `middleware/rbac.ts`) and composed into that entry point. Access is checked before a protected page renders — never after. |
| **BASE-RTE-02** | Each error type has its own dedicated page — 404 Not Found, 401/403 access-denied, 500 server error, etc. — never one generic catch-all error screen for every case. |
| **BASE-RTE-03** | If a user attempts to visit a page they're not authorized to view, they are blocked and shown a clear, specific message explaining why access was denied — never a silent redirect and never a blank page. |

*Note: Next.js only allows a single `middleware.ts` entry point per app, so BASE-RTE-01 reads that as "protection logic lives in a `middleware/` folder, wired into that one entry point" rather than multiple middleware files. Flag if you meant something else.*

## 5. File Storage & Upload

| ID | Requirement |
|---|---|
| **BASE-FUP-01** | Every uploaded file is stored in a CDN-backed object store — never saved to, or served directly from, the app server's own disk/filesystem. |
| **BASE-FUP-02** | Uploads are chunked: the file is split into fixed-size chunks (e.g. 5–10 MB) and sent piece by piece, not as one single request — needed for large-file reliability, upload progress, and resuming after a dropped connection. |
| **BASE-FUP-03** | The chunked-upload logic is built once as a shared library/utility and reused by every upload feature in the app — no screen re-implements its own upload flow. |
| **BASE-FUP-04** | A failed chunk is retried individually, not the whole file — same bounded-retry-with-backoff pattern as BASE-DTR-10. Upload progress uses the same progress-indicator pattern as BASE-DTR-14. |
| **BASE-FUP-05** | Stored file references follow BASE-SEC-01 — the client gets an opaque token/URL, never a raw internal path or bucket key. |

## 6. Data Validation

| ID | Requirement |
|---|---|
| **BASE-VAL-01** | Every field with a defined constraint (required, type, format, range, enum, cross-field rule) is validated on the frontend before submission — immediate inline feedback, no round-trip needed for an obvious mistake. |
| **BASE-VAL-02** | The same constraints are re-validated on the backend before any create or update is persisted, regardless of what the frontend already checked. Frontend validation is a UX convenience, never the sole safeguard — it can be bypassed entirely (a direct API call, a modified request, disabled JS). |
| **BASE-VAL-03** | Validation rules are defined once, in a shared schema, imported by both the frontend form and the backend Route Handler — never written twice, never allowed to drift out of sync between the two. Same centralization principle as step2's `/lib/stock` and `/lib/credit`. |
| **BASE-VAL-04** | A backend validation failure returns field-level detail — which field, what rule failed — not a generic error, so the frontend can surface it against the exact field even in the rare case a malformed request reaches the backend without frontend validation having run. |
| **BASE-VAL-05** | Applies uniformly: every master (step3) and every transaction (step4, step5) validates both save and edit through this same mechanism — not a case-by-case implementation per screen. |

## 7. Keyboard Navigation & Searchable Controls

| ID | Requirement |
|---|---|
| **BASE-NAV-01** | Every dropdown/select control across the app is searchable (type-to-filter) — never a plain unfiltered list, regardless of how few or many options it has. |
| **BASE-NAV-02** | The sidebar/main navigation supports arrow-key movement: Up/Down moves the highlighted focus between nav items without touching a mouse. |
| **BASE-NAV-03** | Pressing Enter while a nav item is highlighted navigates to it — same result as clicking it. |
| **BASE-NAV-04** | Applies uniformly, same discipline as BASE-VAL: one shared searchable-select component and one shared keyboard-navigable nav component, built once (NJS-16's shadcn/ui already ships a Command/Combobox primitive suited to this), used everywhere a dropdown or nav list appears — never reimplemented per screen. |

---

Project-specific setup (framework choices, testing, hosting, deployment, and everything else about *this* Next.js build) lives in a separate document — **step2.md** — so this file stays a pure, reusable reference.
