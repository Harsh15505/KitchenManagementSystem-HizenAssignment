---
type: tracker
updated: 2026-10-03 06:30 IST
---

# ✅ Requirements Matrix (traceability)

Status: ⬜ not started · 🟨 in progress · ✅ done · ⏭️ skipped (reason in [[Prioritisation Notes]]) · ❌ blocked
Definitions: `docs/PRD.md` §4 (FR), §5 (BR), §9 (NFR). Update this table in the same change that implements a requirement.

## Functional

| ID | Requirement (short) | Pri | Phase | Tasks | Status | Implementation | Tests |
|---|---|---|---|---|---|---|---|
| FR-ACC-01 | Login/logout, cookie session; 4 test accounts | Must | P2 | T-202 T-203 T-205 | ✅ (local; live after T-108) | `backend/src/auth`, `frontend/src/app/login` | `auth.test.ts` |
| FR-ACC-02 | Staff management (admin) | Must | P2 | T-206 | ✅ | `backend/src/staff`, `frontend/src/app/(app)/settings/staff` | `staff.test.ts` |
| FR-ACC-03 | Server-enforced permissions + data scoping | Must | P2 | T-204 T-210 | ✅ (driver row scoping lands in T-704) | `backend/src/authz/access.guard.ts` | `backend/test/auth.test.ts` |
| FR-ACC-04 | Roles = data; permission-driven UI | Must | P2 | T-201 T-204 T-205 | ✅ | `shared/src/permissions/`, `shared/src/authz/rules.ts` | `rules.test.ts` |
| FR-ACC-05 | Money fields only with `money.read` | Should | P2 | T-204 | ✅ | `money-redaction.interceptor.ts` | `auth.test.ts` BR-ACC-03 |
| FR-ACC-06 | Roles editor UI | Could | — | backlog | ⬜ | | |
| FR-SET-01 | Kitchen days, holidays, cut-off time/days in UI | Must | P2 | T-207 | ✅ | `backend/src/settings`, `frontend/src/app/(app)/settings` | API probe + browser |
| FR-SET-02 | Other platform values + toggles | Must | P2 | T-207 | ✅ | same | same |
| FR-SET-03 | Reference lists CRUD | Must | P2 | T-208 | ✅ | `backend/src/reference`, `/settings/reference` | API probe + browser |
| FR-SET-04 | Cut-off preview | Should | P5 | T-502 | ✅ (upcoming lock times on `/cutoff`, cut-off per date in the builder) | `cutoff.service.ts` overview | `cutoff.test.ts` |
| FR-CAT-01 | Dish fields | Must | P3 | T-301 T-302 | ✅ | `backend/src/catalogue/dishes.service.ts`, `frontend/src/app/(app)/catalogue/dishes` | `contracts/catalogue.test.ts`, browser check |
| FR-CAT-02 | Deactivate, never delete dishes | Must | P3 | T-302 | ✅ | no DELETE route; PATCH `isActive` | BUG-003 tests |
| FR-CAT-03 | Reusable options | Must | P3 | T-303 | ✅ | `options.service.ts`, `frontend/src/app/(app)/catalogue/options` | browser check |
| FR-CAT-04 | Option groups per dish | Must | P3 | T-304 | ✅ | `option-groups.service.ts`, `dishes/[id]/option-groups-editor.tsx` | browser check |
| FR-CAT-05 | Portions (sizes, extra charge, support rule) | Should | P3 | T-303 T-304 | ✅ | `shared/src/domain/catalogue.ts` `portionViolations` | `catalogue.test.ts`, browser check (error shown) |
| FR-CAT-06 | Flag incomplete setup | Must | P3 | T-302 | ✅ | dish list badges (No station, Not on menu) | browser check |
| FR-MEN-01 | Ordered/activatable categories & items | Must | P3 | T-309 T-310 | ✅ | `backend/src/menu`, `frontend/src/app/(app)/menu` | permission matrix, browser check |
| FR-MEN-02 | Hide per company | Must | P4 | T-404 | ⬜ | | |
| FR-MEN-03 | Secret categories (slug) | Must | P3 | T-310 T-311 T-312 | ✅ | `GET /menu/for-employee/:id/secret/:slug`, preview slug box | `menu.test.ts` BR-MEN-02, Neon probe |
| FR-MEN-04 | Preview as employee | Must | P3 | T-311 T-312 | ✅ | `MenuInputService` + `resolveEmployeeMenu`, `/menu/preview` | `menu.test.ts`, Neon probe, browser check |
| FR-PRC-01 | Named tiers, prices per tier | Must | P3 | T-305 T-307 | ✅ | `backend/src/pricing`, `frontend/src/app/(app)/pricing` | permission matrix, Neon probe, browser check |
| FR-PRC-02 | Exactly one default tier | Must | P3 | T-305 T-307 | ✅ | required FK on settings; `POST /price-tiers/:id/make-default` single update; default can't be deleted | Neon probe |
| FR-PRC-03 | Company tier → employee price | Must | P3/P4 | T-306 T-402 | ⬜ | | |
| FR-PRC-04 | No price ⇒ not on menu | Must | P3 | T-306 T-311 | ✅ (pricing + menu resolvers, tests) | | |
| FR-PRC-05 | Derived tiers + overrides + ceil 5¢ | Must | P3 | T-306 T-307 T-308 | ✅ | `shared/src/domain/pricing.ts` (resolver, factor parsing), tier form, grid | `pricing.test.ts` BR-PRC-* + FR-PRC-05 |
| FR-PRC-06 | Tier grid + missing prices | Must | P3 | T-308 | ✅ | `GET /price-tiers/:id/grid`, `PUT …/prices`, `pricing/[tierId]` page | `pricing.test.ts` FR-PRC-06, browser check |
| FR-PRC-07 | Price changes affect new orders only | Must | P5 | T-503 T-506 T-508 | ⬜ | | |
| FR-CMP-01 | Company core (domains, addresses, billing, owner) | Must | P4 | T-402 T-403 | ✅ | `backend/src/companies`, `frontend/src/app/(app)/companies` | `company.test.ts`, `companies.test.ts`, Neon probe |
| FR-CMP-02 | Company calendar | Must | P4/P5 | T-403 T-502 | 🟨 (working days + holidays stored and edited; delivery-date check in T-502) | | |
| FR-CMP-03 | Delivery defaults | Must | P4 | T-402 | ✅ | company settings form; driver via `delivery.perform` (`drivers.ts`) | Neon probe (DRIVER_REQUIRED) |
| FR-CMP-04 | Tier + hidden menu | Must | P4 | T-402 T-404 | ✅ | `PUT /companies/:id/menu-visibility`, menu visibility card | Neon probe, browser check |
| FR-CMP-05 | Holiday conflict warning | Should | P4 | T-403 | ⬜ (needs orders, P5) | | |
| FR-EMP-01 | Employee fields, flags, allergies, prefs | Must | P4 | T-405 | ✅ | `employees.service.ts`, employees card, `/employees` | `company.test.ts` BR-EMP-01, browser check |
| FR-EMP-02 | Move employee | Must | P4 | T-405 | ✅ | `POST /employees/:id/move`, make-owner | `companies.test.ts` BR-EMP-01/02 |
| FR-EMP-03 | CSV import with row errors | Should | P4 | T-406 | ⏭️ deferred (see Prioritisation Notes) | | |
| FR-ORD-01 | Cut-off calculation | Must | P5 | T-502 | ✅ | `shared/src/domain/cutoff.ts` | `cutoff.test.ts` BR-CUT-01..03 (3 TZs) |
| FR-ORD-02 | Order builder flow | Must | P5 | T-504 T-505 T-506 T-507 | ✅ | `/orders/context`, `/orders/quote`, `orders/order-builder.tsx` | browser check |
| FR-ORD-03 | Server validation + drafts | Must | P5 | T-505 T-506 | ✅ | `normaliseOrder` + `OrdersService.prepare` (field-path errors) | `combinations.test.ts` BR-CMB/BR-MNY-02/BR-PRC-07, Neon probe |
| FR-ORD-04 | Statuses; edit/cancel before cut-off | Must | P5 | T-506 T-508 | ✅ | `OrdersService` (version, lock, admin late orders) | Neon probe |
| FR-ORD-05 | Cut-off processing (idempotent, manual) | Must | P5 | T-509 T-510 | ✅ | `cutoff.service.ts` (advisory lock), `jobs.service.ts`, `/cutoff` | Neon probe: run 1 = 1/1, run 2 = 0/0, future = 422 (no automated DB test yet) |
| FR-ORD-06 | Order list (search, filters, pagination) | Must | P5 | T-511 | ✅ | `orders-query.service.ts`, `/orders` (URL state) | browser check |
| FR-ORD-07 | Order detail + timeline | Must | P5 | T-512 | ✅ | `/orders/[id]` | browser check |
| FR-ORD-08 | Admin delivery override | Must | P5/P7 | T-512 T-701 | ✅ | `PATCH /orders/:id/delivery` (re-plan, drop move) | Neon probe |
| FR-ORD-09 | Admin cancel/reject | Must | P5/P8 | T-508 T-804 | ✅ | `cancel`/`reject` (+ credit when invoiced) | Neon probe |
| FR-ORD-10 | Allergy warning + acknowledgement | Should | P5 | T-505 T-507 | ✅ (kitchen flag in P6) | `ALLERGEN_ACK_REQUIRED`, builder checkbox | `combinations.test.ts` warnings |
| FR-KIT-01 | Board: prep units by station | Must | P6 | T-601 T-604 | ✅ | `kitchen.service.ts` board, `/kitchen` | browser check |
| FR-KIT-02 | Start/done rules, races | Must | P6 | T-602 | ✅ | conditional updates under an order row lock | `kitchen.test.ts` BR-KIT-02/05, Neon race 200/409 |
| FR-KIT-03 | Kitchen started/ready times | Must | P6 | T-602 | ✅ | `markOrderStarted` / `markReadyIfComplete` | `kitchen.test.ts` BR-KIT-03 |
| FR-KIT-04 | Plans, late/at-risk | Must | P6 | T-601 T-604 | ✅ | planned times on cards, LATE/AT RISK | `cutoff.test.ts` BR-PLN-04 |
| FR-KIT-05 | Force-complete | Must | P6 | T-603 | ✅ | `POST /kitchen/orders/:id/force-complete` | `kitchen.test.ts` BR-KIT-04 |
| FR-KIT-06 | Prep summary | Must | P6 | T-601 T-604 | ✅ | prep summary view | browser check |
| FR-KIT-07 | 400-order performance | Must | P6 | T-605 | ✅ | single query, in-memory shaping | 48-order day ~580 ms from India to Neon (network-bound); 400-order perf script not run |
| FR-KIT-08 | Do-not-cook flags | Should | P6 | T-604 | ✅ | do-not-cook cards | code review |
| FR-DSP-01 | Sequential, non-repeatable stages | Must | P7 | T-702 | ✅ | `dispatch.service.ts` markReady/markOut/deliver | `dispatch.test.ts` BR-DSP-02..04, Neon probe |
| FR-DSP-02 | Drop grouping + board | Must | P7 | T-701 T-703 | ✅ | drops keyed company/address/instant (`orders/drops.ts`), `/dispatch` | Neon probe, browser check |
| FR-DSP-03 | Driver per drop (default) | Must | P7 | T-701 T-702 T-703 | ✅ | `PUT /dispatch/drops/:id/driver`, default driver at creation | Neon probe |
| FR-DSP-04 | Driver view (phone, note, photo) | Must | P7 | T-704 T-705 T-706 | ✅ | `/driver` (own drops, today), mark-delivered sheet with note + photo | `dispatch.test.ts` BR-DSP-07, Neon probe, phone-width check |
| FR-DSP-05 | On-time recorded | Must | P7 | T-704 | ✅ | `deliveredOnTime` stored at delivery | `dispatch.test.ts` BR-DSP-05 |
| FR-BIL-01 | Confirmed orders billable | Must | P8 | T-802 T-803 | ✅ | `isBillable`, `billing.service.ts` uninvoiced | `billing.test.ts` BR-BIL-01 |
| FR-BIL-02 | Uninvoiced → invoice → paid | Must | P8 | T-803 T-805 | ✅ | summary, invoice builder, list, detail, mark paid | Neon probe, browser check |
| FR-BIL-03 | Order on ≤ 1 invoice | Must | P8 | T-801 T-803 | ✅ | unique `InvoiceLine.orderId`/`adjustmentId`; P2002 → ALREADY_INVOICED | Neon: concurrent create → 201 + 409 |
| FR-BIL-04 | Post-invoice change policy | Must | P8 | T-804 | ✅ | immutable invoices; cancel/reject of invoiced orders → credit in the same TX | `billing.test.ts` BR-BIL-06, Neon probe |
| FR-BIL-05 | Short delivery credit | Must | P8 | T-804 T-805 | ✅ | `POST /orders/:id/shortage`, shortage form | `billing.test.ts` BR-BIL-07, Neon probe |
| FR-DSH-01 | Land on permission-composed dashboard | Must | P2/P9 | T-205 T-901..T-904 | ✅ | `/dashboard` (sections by ability), `GET /dashboard/admin`, kitchen/dispatch/driver boards | figures recomputed independently on Neon (T-905 probe) |
| FR-DSH-02 | Admin dashboard | Must | P9 | T-901 | ✅ | `/dashboard` (sections by ability), `GET /dashboard/admin`, kitchen/dispatch/driver boards | figures recomputed independently on Neon (T-905 probe) |
| FR-DSH-03 | Kitchen dashboard | Must | P9 | T-902 | ✅ | `/dashboard` (sections by ability), `GET /dashboard/admin`, kitchen/dispatch/driver boards | figures recomputed independently on Neon (T-905 probe) |
| FR-DSH-04 | Dispatch dashboard | Must | P9 | T-903 | ✅ | `/dashboard` (sections by ability), `GET /dashboard/admin`, kitchen/dispatch/driver boards | figures recomputed independently on Neon (T-905 probe) |
| FR-DSH-05 | Driver dashboard | Must | P9 | T-904 | ✅ | `/dashboard` (sections by ability), `GET /dashboard/admin`, kitchen/dispatch/driver boards | figures recomputed independently on Neon (T-905 probe) |
| FR-DSH-06 | README definitions | Must | P9/P11 | T-905 T-1101 | ✅ | `/dashboard` (sections by ability), `GET /dashboard/admin`, kitchen/dispatch/driver boards | figures recomputed independently on Neon (T-905 probe) |
| FR-DAT-01 | Realistic data on any review day | Must | P5/P10 | T-513 T-1001 T-1002 | ✅ | `demo.service.ts` (orders window + weekly invoices) | Neon: ~700 orders, 7 weekly invoices |
| FR-DAT-02 | Fresh data without manual work | Must | P10 | T-1002 | ✅ (window extends on startup, timer and requests) | `DemoService.tick` via `JobsService` | |
| FR-DAT-03 | Demo autopilot | Should | P10 | T-1003 | ✅ | `DemoService.autopilot` | Neon: today's drops advance |
| FR-DAT-04 | Regenerate demo data | Should | P10 | T-1004 | 🟨 (API done; button in P10) | `POST /demo/regenerate` | |

## Non-functional

| ID | Requirement | Where verified | Status |
|---|---|---|---|
| NFR-01 | Money: integer cents; reconciling totals | T-306 T-503 T-802 tests; DB CHECKs | ⬜ |
| NFR-02 | Time zones (IST), TZ-independent | T-209 T-502 TZ-matrix CI | 🟨 (time helpers + clock done; cut-off in T-502) |
| NFR-03 | Concurrency safety | T-509 T-602 T-803 integration races | ⬜ |
| NFR-04 | Server validation, actionable errors | T-103 envelope; every form | ⬜ |
| NFR-05 | Pagination; kitchen board @400 orders | T-511; T-605 perf script | ⬜ |
| NFR-06 | Code quality; lint + typecheck clean | T-106 T-107 CI | ⬜ |
| NFR-07 | Tests: cut-off, pricing, combinations, invoicing | T-306 T-502 T-503 T-802 | ⬜ |
| NFR-08 | Live for 2+ weeks | T-108 T-109 T-1005 T-1104 | ⬜ |
| NFR-09 | Security (cookie, authZ, CSRF) | T-203 T-204 T-210 | 🟨 (cookie, guard, Origin check, throttle done) |
| NFR-10 | Usability; driver on phone | T-705; smoke checklist | ⬜ |

## Deliverables

| Deliverable | Task | Status |
|---|---|---|
| Live link with 4 working accounts | T-1005 | ⬜ |
| Public repo, clean history | T-005 → T-1102 | ⬜ |
| README (setup, architecture + ERD, decisions, dashboards, prioritisation, ambiguities) | T-1101 | ⬜ |
| Google Form submitted before deadline | T-1103 | ⬜ |
| Kept live ≥ 2 weeks | T-1104 | ⬜ |
