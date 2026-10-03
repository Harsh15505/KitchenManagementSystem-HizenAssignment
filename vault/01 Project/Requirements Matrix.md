---
type: tracker
updated: 2026-10-03 01:30 IST
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
| FR-SET-04 | Cut-off preview | Should | P5 | T-502 | ⬜ (needs the cut-off calculator) | | |
| FR-CAT-01 | Dish fields | Must | P3 | T-301 T-302 | ⬜ | | |
| FR-CAT-02 | Deactivate, never delete dishes | Must | P3 | T-302 | ⬜ | | |
| FR-CAT-03 | Reusable options | Must | P3 | T-303 | ⬜ | | |
| FR-CAT-04 | Option groups per dish | Must | P3 | T-304 | ⬜ | | |
| FR-CAT-05 | Portions (sizes, extra charge, support rule) | Should | P3 | T-303 T-304 | ⬜ | | |
| FR-CAT-06 | Flag incomplete setup | Must | P3 | T-302 | ⬜ | | |
| FR-MEN-01 | Ordered/activatable categories & items | Must | P3 | T-309 T-310 | ⬜ | | |
| FR-MEN-02 | Hide per company | Must | P4 | T-404 | ⬜ | | |
| FR-MEN-03 | Secret categories (slug) | Must | P3 | T-310 T-311 T-312 | 🟨 (rule + tests done) | | |
| FR-MEN-04 | Preview as employee | Must | P3 | T-311 T-312 | 🟨 (resolver: `shared/src/domain/menu.ts`) | | |
| FR-PRC-01 | Named tiers, prices per tier | Must | P3 | T-305 T-307 | ⬜ | | |
| FR-PRC-02 | Exactly one default tier | Must | P3 | T-305 T-307 | ⬜ | | |
| FR-PRC-03 | Company tier → employee price | Must | P3/P4 | T-306 T-402 | ⬜ | | |
| FR-PRC-04 | No price ⇒ not on menu | Must | P3 | T-306 T-311 | ✅ (pricing + menu resolvers, tests) | | |
| FR-PRC-05 | Derived tiers + overrides + ceil 5¢ | Must | P3 | T-306 T-307 T-308 | 🟨 (resolver: `shared/src/domain/pricing.ts`, `pricing.test.ts`) | | |
| FR-PRC-06 | Tier grid + missing prices | Must | P3 | T-308 | ⬜ | | |
| FR-PRC-07 | Price changes affect new orders only | Must | P5 | T-503 T-506 T-508 | ⬜ | | |
| FR-CMP-01 | Company core (domains, addresses, billing, owner) | Must | P4 | T-402 T-403 | ⬜ | | |
| FR-CMP-02 | Company calendar | Must | P4/P5 | T-403 T-502 | ⬜ | | |
| FR-CMP-03 | Delivery defaults | Must | P4 | T-402 | ⬜ | | |
| FR-CMP-04 | Tier + hidden menu | Must | P4 | T-402 T-404 | ⬜ | | |
| FR-CMP-05 | Holiday conflict warning | Should | P4 | T-403 | ⬜ | | |
| FR-EMP-01 | Employee fields, flags, allergies, prefs | Must | P4 | T-405 | ⬜ | | |
| FR-EMP-02 | Move employee | Must | P4 | T-405 | ⬜ | | |
| FR-EMP-03 | CSV import with row errors | Should | P4 | T-406 | ⬜ | | |
| FR-ORD-01 | Cut-off calculation | Must | P5 | T-502 | ⬜ | | |
| FR-ORD-02 | Order builder flow | Must | P5 | T-504 T-505 T-506 T-507 | ⬜ | | |
| FR-ORD-03 | Server validation + drafts | Must | P5 | T-505 T-506 | ⬜ | | |
| FR-ORD-04 | Statuses; edit/cancel before cut-off | Must | P5 | T-506 T-508 | ⬜ | | |
| FR-ORD-05 | Cut-off processing (idempotent, manual) | Must | P5 | T-509 T-510 | ⬜ | | |
| FR-ORD-06 | Order list (search, filters, pagination) | Must | P5 | T-511 | ⬜ | | |
| FR-ORD-07 | Order detail + timeline | Must | P5 | T-512 | ⬜ | | |
| FR-ORD-08 | Admin delivery override | Must | P5/P7 | T-512 T-701 | ⬜ | | |
| FR-ORD-09 | Admin cancel/reject | Must | P5/P8 | T-508 T-804 | ⬜ | | |
| FR-ORD-10 | Allergy warning + acknowledgement | Should | P5 | T-505 T-507 | ⬜ | | |
| FR-KIT-01 | Board: prep units by station | Must | P6 | T-601 T-604 | ⬜ | | |
| FR-KIT-02 | Start/done rules, races | Must | P6 | T-602 | ⬜ | | |
| FR-KIT-03 | Kitchen started/ready times | Must | P6 | T-602 | ⬜ | | |
| FR-KIT-04 | Plans, late/at-risk | Must | P6 | T-601 T-604 | ⬜ | | |
| FR-KIT-05 | Force-complete | Must | P6 | T-603 | ⬜ | | |
| FR-KIT-06 | Prep summary | Must | P6 | T-601 T-604 | ⬜ | | |
| FR-KIT-07 | 400-order performance | Must | P6 | T-605 | ⬜ | | |
| FR-KIT-08 | Do-not-cook flags | Should | P6 | T-604 | ⬜ | | |
| FR-DSP-01 | Sequential, non-repeatable stages | Must | P7 | T-702 | ⬜ | | |
| FR-DSP-02 | Drop grouping + board | Must | P7 | T-701 T-703 | ⬜ | | |
| FR-DSP-03 | Driver per drop (default) | Must | P7 | T-701 T-702 T-703 | ⬜ | | |
| FR-DSP-04 | Driver view (phone, note, photo) | Must | P7 | T-704 T-705 T-706 | ⬜ | | |
| FR-DSP-05 | On-time recorded | Must | P7 | T-704 | ⬜ | | |
| FR-BIL-01 | Confirmed orders billable | Must | P8 | T-802 T-803 | ⬜ | | |
| FR-BIL-02 | Uninvoiced → invoice → paid | Must | P8 | T-803 T-805 | ⬜ | | |
| FR-BIL-03 | Order on ≤ 1 invoice | Must | P8 | T-801 T-803 | ⬜ | | |
| FR-BIL-04 | Post-invoice change policy | Must | P8 | T-804 | ⬜ | | |
| FR-BIL-05 | Short delivery credit | Must | P8 | T-804 T-805 | ⬜ | | |
| FR-DSH-01 | Land on permission-composed dashboard | Must | P2/P9 | T-205 T-901..T-904 | ⬜ | | |
| FR-DSH-02 | Admin dashboard | Must | P9 | T-901 | ⬜ | | |
| FR-DSH-03 | Kitchen dashboard | Must | P9 | T-902 | ⬜ | | |
| FR-DSH-04 | Dispatch dashboard | Must | P9 | T-903 | ⬜ | | |
| FR-DSH-05 | Driver dashboard | Must | P9 | T-904 | ⬜ | | |
| FR-DSH-06 | README definitions | Must | P9/P11 | T-905 T-1101 | ⬜ | | |
| FR-DAT-01 | Realistic data on any review day | Must | P5/P10 | T-513 T-1001 T-1002 | ⬜ | | |
| FR-DAT-02 | Fresh data without manual work | Must | P10 | T-1002 | ⬜ | | |
| FR-DAT-03 | Demo autopilot | Should | P10 | T-1003 | ⬜ | | |
| FR-DAT-04 | Regenerate demo data | Should | P10 | T-1004 | ⬜ | | |

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
