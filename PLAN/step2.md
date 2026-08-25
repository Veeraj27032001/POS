# POS Application — Next.js Project Setup Guide

Companion to **step1.md** (the reusable technical base). Where step1 defines cross-cutting *behavior* requirements, this document defines how *this specific project* is built: framework choices, tooling, and configuration. Written as a build guide — each item is either a decision or an honest "pending," not an open question.

---

## 1. Framework & Tooling

**NJS-01 — Routing Model: App Router**
The base uses the Next.js App Router, not the Pages Router.

**NJS-02 — Language: TypeScript**
Built in TypeScript, strict mode by default.

**NJS-03 — Package Manager: pnpm**
Faster installs and lower disk usage than npm/yarn; scales cleanly if this ever becomes a monorepo.

**NJS-04 — App Structure: Single App (+ thin Electron shell)**
The Next.js app itself stays a single app, not a monorepo. NJS-23's Electron wrapper is a second, much smaller deliverable alongside it — it just loads the hosted URL and carries the hardware-bridge code, so it doesn't need full monorepo tooling (Turborepo/Nx). Revisit toward a monorepo only if another genuinely separate app (e.g. a standalone admin app) shows up later.

## 2. Backend & API Architecture

**NJS-05 — Backend Data Access: Direct Route Handlers**
Next.js Route Handlers call the database directly through the ORM (NJS-07) — no separate backend service. Revisit only if a second, independent client app later needs to share this same logic.

**NJS-06 — Database Engine: Pending**
Being finalized separately (already in progress outside this doc). Everything else here assumes a Postgres-compatible database; flag if that assumption turns out wrong.

**NJS-07 — ORM: Prisma**
Best-supported option for Postgres + TypeScript + Route Handlers; strong type inference straight from the schema.

**NJS-08 — API Versioning: None for now**
Internal API only, no external consumers yet — no version prefix. Add one (`/api/v1/...`) if a third party ever needs to integrate directly.

## 3. Data Fetching & Client State

**NJS-09 — Data-Fetching Library: TanStack Query**
Implements BASE-DTR directly: count-first loads, page-scoped in-memory caching, TTL/stale-while-revalidate, abort-on-navigate, and retry-with-backoff are all built in rather than hand-rolled.

**NJS-10 — Global State: React Context (minimal)**
TanStack Query covers server state; only reach for Zustand if a real cross-page client-only state need shows up (e.g. an in-progress cart before checkout).

## 4. Auth, RBAC & Audit

**NJS-11 — Auth Mechanism: Auth.js (NextAuth)**
Session-based auth, integrates cleanly with middleware for BASE-RTE route guards.

**NJS-12 — MFA: Authenticator App (TOTP)**
No SMS cost or delivery risk; standard baseline for staff logins.

**NJS-13 — RBAC Model: Fixed Role Set (to start)**
A small fixed set of roles (e.g. Owner, Manager, Cashier) rather than a fully dynamic permissions table — simpler to build and audit first. Move to dynamic permissions later if the app requirements call for finer-grained control.

**NJS-14 — Opaque ID Scheme: UUIDv4**
Generated at the DB layer, used directly as the client-facing token per BASE-SEC-01 — no extra encoding layer needed.

**NJS-15 — Audit Log Storage: Dedicated DB Table**
Simplest to query and join against the data it's auditing. Move to an external log pipeline only if a compliance requirement demands it later.

## 5. UI & Styling

**NJS-16 — Component Library: shadcn/ui**
Composable, Tailwind-based, no runtime CSS-in-JS overhead — a good fit for a data-table-heavy POS UI.

**NJS-17 — Styling: Tailwind CSS**

**NJS-18 — Design Tokens: Default Tailwind Theme (for now)**
Swap in real brand tokens (colors, type scale) once brand assets exist — no need to block scaffolding on this.

## 6. Localization & Defaults

**NJS-19 — Locale: Single Locale (English) to Start**
No multi-language support built in initially. Add `next-intl` (or similar) only if multi-language is confirmed as an actual requirement.

**NJS-20 — Default Timezone & Date Format: Asia/Kolkata, DD/MM/YYYY, 12h**
Matches the India market this is being built for; used as the BASE-DTH-02/03 fallback and overridable per organization later.

**NJS-21 — Currency & Number Format: INR (₹), Indian digit grouping**
Lakh/crore grouping, not the international thousands grouping.

## 7. POS-Specific Environment Factors

**NJS-22 — Offline Support: Always-Online**
No PWA or offline mode — stock must stay live and accurate (BASE-DTR-08). Resilience to brief connectivity drops comes from retry/backoff on live requests, not an offline queue.

**NJS-23 — Hardware Access: Electron Wrapper**
Reversed from the earlier web-only call. The Electron `BrowserWindow` loads the hosted Next.js app directly — not a static bundle, so BASE-RTE server-rendering and NJS-05's Route Handlers keep working unchanged. The Electron **main process** handles receipt printer, cash drawer, and card/UPI payment terminal integration using Node hardware libraries (e.g. `escpos`, `node-thermal-printer`, `node-serialport`) and, for the payment terminal specifically, Razorpay's own POS device SDK (step5, Section 6's `card_machine` method) — all exposed to the web page through a `contextBridge` preload script (e.g. `window.hardware.print(receipt)`, `window.hardware.chargeCard(amount)`). Barcode scanners still need no special handling — they emulate a keyboard and work the same inside Electron's renderer.

Chosen over Tauri: POS hardware-vendor SDKs overwhelmingly target Node.js/Electron already, where Tauri would mean writing that hardware glue in Rust from scratch. Bundle size and memory — Tauri's main advantage — matter less on a dedicated terminal device than on something users download repeatedly.

**NJS-24 — Real-Time Sync: Managed Realtime Service**
Via a managed service (e.g. Supabase Realtime, Pusher, or Ably) rather than a custom WebSocket server — keeps it hosting-agnostic regardless of what NJS-29 lands on.

**NJS-35 — Payment Gateway: Razorpay**
step5's QR/Link payment collection and Bill Payment reconciliation integrate against Razorpay's API — chosen for India-market UPI/card coverage and a webhook model that fits step5 Section 6's request-then-poll-status pattern directly. UPI is included by default through Razorpay — no separate integration needed for it; it's just one of the payment methods Razorpay's checkout already supports, alongside cards and net banking.

**NJS-25 — Multi-Tenant: Yes, Store-Scoped**
Confirmed with the app requirements (step3.md): multiple stores, each with its own users and stock. Every operational user is assigned to exactly one store and sees only that store's data; cross-store visibility is limited to an Admin/Owner-level role. Enforced two ways together: BASE-RTE middleware for RBAC (what actions a role can take) plus a `store_id` filter on every store-scoped query (which store's data those actions touch) — see step3.md Sections 11–12.

## 8. Testing & Quality

**NJS-26 — Unit/Integration Testing: Vitest**
Faster than Jest, native ESM/TS support, minimal config with Next.js.

**NJS-27 — E2E Testing: Playwright**
Best cross-browser support and the most reliable for POS-style flows with lots of async UI state.

**NJS-28 — Linting/Formatting: ESLint + Prettier + Husky/lint-staged**
Standard Next.js ESLint config, Prettier for formatting, pre-commit hook so nothing unformatted or failing lint reaches the repo.

## 9. Deployment & Environments

**NJS-29 — Hosting Target: Pending**
Not yet decided between Vercel/serverless and self-hosted — genuinely open. Doesn't block scaffolding since NJS-24's real-time approach was deliberately chosen to be hosting-agnostic.

**NJS-30 — Environments & Secrets: dev/staging/prod via env vars**
Local `.env` files for development; secrets move into the hosting platform's secret manager once NJS-29 is decided.

**NJS-31 — Monitoring: Sentry**
Error tracking and performance monitoring baseline; works the same regardless of which way NJS-29 lands.

## 10. Project Structure Conventions

**NJS-32 — Structure: Feature-Based Folders**
```
/app                     → routes (App Router)
/features/{name}/        → components, hooks, api logic per feature
/lib                     → shared base utilities:
  /lib/pagination         → BASE-DTR (TanStack Query wrapper)
  /lib/datetime           → BASE-DTH utilities
  /lib/security           → BASE-SEC (opaque IDs, encryption helpers)
  /lib/upload             → BASE-FUP (chunked upload library)
  /lib/stock              → step4 Section 7's on_hand/available/expired calculation — the ONE place stock math is written; billing's oversell check, low-stock alerts, and any stock report all call into this, never re-derive it themselves
  /lib/credit             → step5's Credit Bill outstanding-balance calculation — same rule: one function, every consumer calls it
  /lib/validation         → BASE-VAL's shared schemas (step1) — imported by both the frontend form and the backend Route Handler for every master and transaction, so validation rules exist in exactly one place
/middleware               → BASE-RTE guard logic, wired into middleware.ts
```

**NJS-33 — Naming Convention: Standard Next.js/TS conventions**
camelCase for functions/variables, kebab-case for file names, PascalCase for components. No existing ERP-platform naming convention was provided to mirror instead — flag if one exists.

## 11. Storage & CDN

**NJS-34 — Storage/CDN Provider: Supabase Storage**
Bundles with the DB/Auth/Realtime path already assumed above (NJS-06/24) and is CDN-backed out of the box, satisfying BASE-FUP-01 with no extra service to wire up. Revisit if the final database choice isn't Postgres/Supabase.

---

**Still genuinely open:** NJS-06 (database engine) and NJS-29 (hosting target) — both depend on decisions outside this document (the DB team, and a deployment call). Everything else, including NJS-25, is now a working decision, ready to scaffold against.
