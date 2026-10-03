---
type: decisions
updated: 2026-10-03 18:47 IST
---

# 🧭 Decision Log (ADRs)

Chronological. **Never delete**; mark superseded entries with `Status: Superseded by ADR-xxx`. Product interpretations of ambiguous requirements are in `docs/PRD.md` §10 (A-01…A-40). Changing one of them requires an ADR here.

Template: `_templates/Decision Template.md`.

---

### ADR-001: Monorepo with a shared package
- **Status:** Superseded in part by **ADR-022** (folder layout, no Turborepo) · 2026-10-03 · owner-confirmed (Q-02)
- **Context:** Next.js and NestJS must share contracts and rules; reviewers read one history.
- **Decision:** pnpm workspaces + Turborepo. `apps/web`, `apps/api`, `packages/shared` (`@fernleaf/shared`: Zod contracts, permission catalogue, pure domain functions, error codes; built with tsup).
- **Alternatives:** two repos (types duplicated or published); Nx (heavier).
- **Consequences:** shared must build before the apps (`^build`); one CI pipeline; a single source of truth for validation and rules.

### ADR-002: Hosting on Vercel + Render + Neon (Singapore)
- **Status:** Accepted · 2026-10-03 · owner-confirmed (Q-01)
- **Context:** free tiers; must be live for 2+ weeks; reviewers in India; needs background jobs.
- **Decision:** Web on Vercel. API on a Render free web service (Singapore), kept awake by UptimeRobot hitting `/api/health`. Postgres 17 on Neon free (Singapore, 0.25 CU fixed).
- **Alternatives:** Railway (simplest, but paid after trial); everything on Vercel (no long-running process, so timers would need an external cron); Supabase DB (pauses after idle weeks; IPv4 pooler quirks).
- **Consequences:** must respect Render's 750 h/month (one always-on free service) and Neon's 100 CU-h/month (→ ADR-013).

### ADR-003: Same-origin API proxy + httpOnly cookie JWT
- **Status:** Accepted · 2026-10-03
- **Context:** web and API are on different domains; third-party cookies are unreliable; auth must live in the API.
- **Decision:** Next.js `rewrites` proxy `/api/*` to the API; the API issues a JWT in the `fl_session` cookie (HttpOnly, Secure, SameSite=Lax, host-only); Origin check on mutations; `proxy.ts` does only a presence redirect.
- **Alternatives:** Bearer token in localStorage (readable by XSS); NextAuth (auth logic in Next, against the "API owns logic" rule); CORS + SameSite=None cookies (third-party cookie problems).
- **Consequences:** `API_ORIGIN` is needed at web build time; CORS stays off; the browser only ever talks to one origin.

### ADR-004: Permission-based RBAC, roles as data
- **Status:** Principle accepted; implementation superseded by **ADR-023** (CASL) · 2026-10-03
- **Context:** "Adding a new role later should not mean hunting through the codebase for role-name checks."
- **Decision:** a code-defined permission catalogue; `Role` rows hold permission code arrays; `@RequirePermissions` on every route; a fail-closed boot check; row scoping in services; "driver" = has `delivery.perform`; money fields stripped without `money.read` (relies on the `*Cents` naming convention).
- **Alternatives:** `@Roles('admin')` decorators; CASL/attribute-based access control (overkill).
- **Consequences:** a new role is an insert; the UI nav and dashboards are derived from permissions; an ESLint rule bans role-name literals outside seeds.

### ADR-005: Money as integer cents; factors in basis points
- **Status:** Accepted · 2026-10-03
- **Context:** no floating-point errors; derived prices round up to the next 5¢.
- **Decision:** all amounts are `Int` cents (`*Cents`); multipliers and percentages are `factorBps` (10000 = ×1); `deriveCents = divCeil(base × bps, 50000) × 5` using exact integer division.
- **Alternatives:** `Decimal` columns + decimal.js (heavier, easy to mix with floats).
- **Consequences:** formatting happens only at the edges (`formatUsd`); reconciliation is provable in tests.

### ADR-006: Single kitchen time zone (IST) and USD
- **Status:** Accepted · 2026-10-03 · owner-confirmed (Q-05)
- **Context:** cut-offs, delivery dates and "today" must not depend on the server or browser TZ; reviewers are in IST; the owner chose to keep the brief's dollars and cents.
- **Decision:** `PlatformSettings.kitchenTimezone = 'Asia/Kolkata'` (read-only); delivery dates as `DATE` (kitchen-local); instants as `timestamptz`; "today" computed on the server by `ClockService`; times displayed with an explicit `timeZone`; production server `TZ=UTC`; domain tests in a TZ matrix. Currency **USD** (integer cents, `formatUsd`).
- **Alternatives:** browser-local dates; storing local datetimes without a zone; INR (considered and declined by the owner).
- **Consequences:** helpers `toDbDate`/`fromDbDate`/`toInstant` are mandatory; "IST" labels in the UI.

### ADR-007: Pure domain functions in shared; services own transactions
- **Status:** Accepted · 2026-10-03
- **Decision:** rules (cut-off, pricing, combinations, menu visibility, plans, stages, billing maths) are pure functions in `@fernleaf/shared/domain` with `now` passed in. Nest services load data, call them, and persist inside transactions.
- **Consequences:** fast unit tests for the rules the brief says will break; the web app can reuse them for previews without becoming authoritative.

### ADR-008: Shared Zod contracts + one error envelope
- **Status:** Accepted · 2026-10-03
- **Decision:** Zod 4 schemas in shared, used by React Hook Form and by `nestjs-zod` pipes. Every error is `{ error: { code, message, status, fieldErrors?, details? } }` with codes from shared.
- **Alternatives:** class-validator DTOs (duplicated validation).
- **Consequences:** field paths map straight onto form fields; the UI can switch on stable codes.

### ADR-009: Prices resolved on read; default tier via settings FK
- **Status:** Accepted · 2026-10-03
- **Decision:** tiers are MANUAL, FROM_COST or FROM_TIER (factor in bps). Explicit rows are overrides, and NULL means "not sold on this tier". Effective prices are computed on demand (never stored). The default tier is `PlatformSettings.defaultPriceTierId`, so there is exactly one by construction.
- **Alternatives:** materialised derived prices (recompute jobs, staleness); an `isDefault` flag + partial unique index (Prisma migrations may drop unknown partial indexes).
- **Consequences:** the tier grid computes ~100 rows in memory; the pricing tests cover every source.

### ADR-010: Order snapshots + per-combination price capture
- **Status:** Accepted · 2026-10-03
- **Decision:** order lines and combinations store names, SKU and the captured prices; the order stores tier, address and packaging snapshots. Re-saving an open order keeps captured prices for unchanged combinations (matched by dish + signature) and prices new ones at the current price.
- **Alternatives:** price-history tables with an "as of" lookup (more machinery).
- **Consequences:** history never changes when the catalogue or prices change (BR-PRC-07).

### ADR-011: A combination is the prep unit
- **Status:** Accepted · 2026-10-03
- **Decision:** `OrderCombination` rows are the kitchen units (prep timestamps on the row); a canonical `signature` + unique `(lineId, signature)`; duplicates are merged on input.
- **Alternatives:** a separate PrepUnit table generated at confirmation (sync problems).
- **Consequences:** "each distinct combination = one unit" holds by construction.

### ADR-012: Time-based lock + idempotent cut-off processing
- **Status:** Accepted · 2026-10-03
- **Decision:** the lock is `now ≥ cutoffAt(date)`, computed on every mutation. Processing (drafts → cancelled, placed → confirmed + drops) runs under a per-date advisory lock with status-conditional updates, and every run is logged in `CutoffRun`. Triggers: precise timer, bootstrap catch-up, throttled request catch-up, manual "Run now". There is an `autoCutoffEnabled` toggle.
- **Consequences:** a late job can't let stale edits through; re-runs are safe and visibly 0/0.

### ADR-013: DB-frugal scheduling for the Neon free tier
- **Status:** Accepted · 2026-10-03
- **Context:** Neon free gives 100 CU-h/month (~400 h awake at 0.25 CU) and scales to zero after 5 min.
- **Decision:** no per-minute DB polling; `/api/health` never touches the DB; timers are armed from cached settings; catch-up only on bootstrap and on authenticated requests (≤ 1/min); the autopilot advances only on catch-up.
- **Consequences:** when nobody uses the app, the DB sleeps; usage is checked during review (T-1104).

### ADR-014: Persisted drops, per-drop dispatch, derived order stage
- **Status:** Accepted · 2026-10-03
- **Decision:** a `Drop` with a unique `(companyId, addressId, deliveryAt)` is upserted at confirmation with the company's default driver. Dispatch timestamps, driver, note, photo and on-time live on the drop. The order stage is derived from kitchen fields + drop. Overrides move orders between drops under BR-DSP-06.
- **Alternatives:** computed-only grouping (driver and proof would be duplicated per order).
- **Consequences:** concurrency-safe grouping; one driver and one proof per stop.

### ADR-015: Immutable invoices + adjustments
- **Status:** Accepted · 2026-10-03
- **Decision:** invoices go Issued → Paid only. `InvoiceLine.orderId` and `.adjustmentId` are UNIQUE (an order is on ≤ 1 invoice, enforced by the DB). Cancelling or rejecting an invoiced order creates a `CANCELLATION_CREDIT`; a shortage creates a `SHORT_DELIVERY_CREDIT`. Adjustments are billed on the company's next invoice. Non-money changes never touch billing.
- **Alternatives:** editing invoices in place (breaks reconciliation); void and reissue (more states; kept as a Could).
- **Consequences:** invoice total = Σ lines always; the policy is documented for the README.

### ADR-016: Concurrency patterns
- **Status:** Accepted · 2026-10-03
- **Decision:** optimistic `version` for order edits; `SELECT … FOR UPDATE` on the order for kitchen units and on the drop for dispatch; status-conditional updates for transitions; unique constraints for grouping and invoicing; transaction-scoped advisory locks for cut-off and demo generation.
- **Consequences:** each race returns a specific 409 the UI can explain.

### ADR-017: Rolling demo data + autopilot; 7-day kitchen in the seed
- **Status:** Accepted · 2026-10-03
- **Context:** "today" is whichever day reviewers come (possibly a weekend) within a 2-week window.
- **Decision:** an idempotent window (today−14…+7) generated through the domain functions and recorded in `DemoDay`; the seeded kitchen works 7 days; 7-day client companies with driver@test.com as their default driver; an optional autopilot advances today's seeded orders up to per-drop caps; reviewer (`STAFF`) data is never auto-deleted.
- **Consequences:** every role has work at any hour; the README explains the autopilot and its toggle.

### ADR-018: Delivery photos stored in Postgres
- **Status:** Accepted · 2026-10-03
- **Decision:** client-side compression → `DeliveryPhoto.data` (bytea, ≤ 1 MB typical, 5 MB hard limit), served through an authorised endpoint.
- **Alternatives:** S3/R2/Cloudinary (another service and its secrets); Render disk (ephemeral).
- **Consequences:** fine at demo scale; noted as "production would use object storage".

### ADR-019: UI kit and client data stack
- **Status:** Accepted · 2026-10-03 · owner-confirmed (Q-03)
- **Decision:** shadcn/ui + Tailwind 4, TanStack Query (polling, optimistic updates), TanStack Table (server pagination), React Hook Form + Zod resolver, sonner, lucide.
- **Consequences:** we own the component code; data grids are assembled with TanStack Table.

### ADR-020: Vitest everywhere; TZ-matrix domain tests
- **Status:** Accepted · 2026-10-03
- **Decision:** Vitest in shared, API (with `unplugin-swc` for decorators) and web. CI runs the domain tests under `TZ=UTC`, `America/Los_Angeles` and `Asia/Kolkata`. Integration tests run against a Neon `test` branch.
- **Consequences:** one runner; proven TZ independence.

### ADR-021: Docs are the spec, the vault is the state; vault committed
- **Status:** Accepted · 2026-10-03 · owner-confirmed (Q-04)
- **Decision:** `docs/` = PRD/TRD/DB/Architecture; `vault/` = status, tasks, phases, bugs, decisions, sessions, commits (Obsidian); committed to the public repo; `.obsidian/` and the assignment PDF git-ignored; `AGENTS.md`/`CLAUDE.md` point every agent to the protocol.
- **Consequences:** any agent can resume from the repo alone; vault updates ride along in feature commits.

### ADR-022: Repo layout `frontend/` + `backend/` + `shared/`, pnpm workspaces without Turborepo
- **Status:** Accepted · 2026-10-03 01:51 · owner-confirmed (Q-06). Supersedes the layout part of ADR-001
- **Context:** the owner prefers top-level `frontend/` and `backend/` folders and wasn't familiar with the term "monorepo". The options were explained with pros and cons: two repos, independent folders, workspaces, workspaces + task runner.
- **Decision:** one public repo. pnpm workspaces link `frontend/` (`@fernleaf/frontend`), `backend/` (`@fernleaf/backend`) and `shared/` (`@fernleaf/shared`). **No Turborepo.** `pnpm -r <script>` runs in dependency order, and `pnpm --filter <pkg>... build` builds a package together with its dependencies.
- **Alternatives:** `apps/` + `packages/` + Turborepo (conventional, but one more tool to explain); independent folders with no shared package (types drift); two repos (two histories).
- **Consequences:** deploy roots are `frontend` (Vercel) and the repo root with a backend filter (Render). Scripts, docs and vault paths updated.

### ADR-023: RBAC with CASL abilities built from permission codes
- **Status:** Accepted · 2026-10-03 01:51 · owner-confirmed (Q-07). Supersedes the implementation part of ADR-004; the principle ("roles are data, never check role names") stays
- **Context:** the owner has used CASL before and has to defend every line. CASL centralises row-level rules and gives the same checks on the frontend.
- **Decision:**
  - `Role.permissions` (codes) remains the data model.
  - `shared/src/authz/rules.ts` `buildRules(user)` maps codes to CASL rules, never role names.
  - Backend: `AbilityFactory` → `createPrismaAbility` (a wrapper over `@casl/prisma/runtime` for the Prisma 7 generated client); a global `PoliciesGuard` + `@CheckPolicies` (fail-closed); `accessibleBy()` for row filters (drivers' own drops); `ability.can('read', 'Money')` for money redaction.
  - Frontend: `createMongoAbility(buildRules(me))` + `@casl/react` `<Can>`.
  - Conditions are kept to simple equalities. Business state rules stay out of abilities.
- **Alternatives:** hand-written guards with `@RequirePermissions` (less code; this was the recommended option, declined in favour of familiarity); CASL with role-based ability files (violates the brief); CASL rules stored as JSON per role (fully data-driven, but conditions need interpolation; too complex for now).
- **Consequences:** +1–2 h setup, time-boxed. Fallback: keep `@casl/ability` and write the driver filter by hand. Adding a role = data; adding a capability = a code + one rule line.

### ADR-024: Version pins at scaffold time
- **Status:** Accepted · 2026-10-03 02:15
- **Context:** the npm `latest` tags at scaffold time were Prisma 8.0.0-rc, NestJS 12 (ESM-only) and TypeScript 7.0 (native). Peer ranges: typescript-eslint supports TS < 6.1; nestjs-zod supports Nest ≤ 11; @casl/prisma supports Prisma ≤ 7.
- **Decision:** Prisma **7.10.0**, NestJS **11.2.x**, TypeScript **6.0.3**, Next **16.3.x** / React **19.3**, Zod **4.6**, Vitest **5**, tsup **8.5**, CASL ability **7.0** / prisma **2.0**.
- **Alternatives:** chasing the latest majors (peer conflicts; ESM-only Nest breaks the CJS plan; CASL doesn't support the Prisma RC).
- **Consequences:** matches the docs (Nest 11, Prisma 7). TS 6 deprecates `baseUrl`, so tsup's dts step needs `ignoreDeprecations: "6.0"` (see Gotchas).

### ADR-025: shadcn/ui on Base UI primitives (base-nova style)
- **Status:** Accepted · 2026-10-03 02:55
- **Context:** `shadcn init --defaults` now generates the `base-nova` style, built on Base UI headless primitives. The TRD had assumed Radix.
- **Decision:** keep the current default (Base UI). Both are accessible headless libraries; staying on the CLI default avoids fighting the generator for every component.
- **Consequences:** TRD §2 updated. Component APIs follow the Base UI flavour of shadcn.

### ADR-026: Tier grid as a plain table over one whole-tier response
- **Status:** Accepted · 2026-10-03 06:40
- **Context:** TRD §2 listed TanStack Table for the tier grid. The catalogue is tens of dishes and options, the grid needs per-cell drafts and a preview of the effective price, and price resolution needs every tier and explicit row anyway.
- **Decision:** `GET /price-tiers/:id/grid` returns every active item of one kind for the tier (search and "missing only" filter server-side, no pagination). The page renders a plain shadcn table with dirty-cell drafts and one bulk `PUT`. TanStack Table stays the plan for the order list (server pagination and sorting).
- **Consequences:** TRD §2 and the tier-grid row in §UI updated. If the catalogue grows past a few hundred items, add pagination to the grid endpoint.

### ADR-027: Combination signature sorted by ids, not display order
- **Status:** Accepted · 2026-10-03 07:20
- **Context:** BR-CMB-04 / TRD §8.3 describe the signature as "choices sorted by group order then option order". Price capture on edit (BR-PRC-07) looks combinations up by `(dishId, signature)`. If the signature used display order, reordering groups or options in the catalogue would change the signature of an unchanged combination and silently re-price it on the next edit.
- **Decision:** `signatureOf` sorts `groupId:optionId@size` tokens by id. Display order is kept separately on each choice (`sortOrder`) for the kitchen board and order detail.
- **Consequences:** The canonical identity is stable across catalogue reorders. TRD §8.3 updated.

### ADR-028: Warm Fernleaf brand theme with a dark mode toggle
- **Status:** Accepted · 2026-10-03 16:25 (owner chose "warm kitchen brand" + dark mode toggle)
- **Context:** The first UI used shadcn's neutral defaults and read as unfinished.
- **Decision:** Theme through the shadcn CSS tokens only (fern green primary, warm cream background, saffron accents, soft card shadow; forest-green dark palette). Fraunces for headings, Geist for text. Dark green grouped sidebar. Dark mode via `next-themes` (`class` attribute, default light, remembered per browser). Status badges gain success/warning/info variants.
- **Consequences:** Every screen inherits the look without per-page edits; hard-coded colours keep `dark:` variants. Next.js dev badge overlaps the logo in development only.
- **Follow-up (17:35):** Motion utilities in `globals.css` (`animate-rise`, `stagger`, `animate-grow-x/y`, `animate-soft-pulse`, `lift`), all disabled under `prefers-reduced-motion`; `CountUp` for headline numbers; `.page-title` serif title with a saffron underline. Charts are hand-built divs/CSS (no chart library) to keep the bundle small and the theme tokens in charge.
- **Follow-up (theme switch):** Toggling uses the View Transitions API for a circular reveal from the toggle (600 ms); instant under reduced motion or without support. `disableTransitionOnChange` stays on so element colour transitions don't fight the snapshot. Browsers skip view transitions on hidden tabs.

### ADR-029: One Neon branch for local dev and production (as provisioned)
- **Status:** Accepted · 2026-10-03 18:50 (found during the vault catch-up; owner to confirm Render's `DATABASE_URL` host matches)
- **Context:** TRD §4.1 planned `dev`, `test` and `main` branches. The owner provisioned one Neon project and shared one connection string, used in `backend/.env` and on Render. `SELECT current_setting('neon.branch_id')` from local dev returns `br-quiet-boat-azse3ol5` (endpoint `ep-autumn-forest-azgcpotr`); the seed ran once and production showed the same data. CI never had a database: service tests boot the real Nest modules with a fake Prisma, and races were verified by probes against Neon.
- **Decision:** Keep the single branch until submission. Anything destructive or bulk (the 400-order perf day T-605, the concurrency script T-1206) runs on a **throwaway branch** created from it in the Neon console, with its URL in the git-ignored `backend/.env.perf`. Local clicks are treated as production clicks.
- **Alternatives:** create `dev` now and point local at it (safe for prod, but data diverges and it costs owner time a day before the deadline); run bulk scripts on a far-future date in the live branch and clean up (risk of leftovers on the live app).
- **Consequences:** Local testing changes what reviewers see (e.g. orders moved along today). Probe data must always be deleted. TRD §4.1/§9 and ARCHITECTURE §4/§10 carry "as built" notes.
