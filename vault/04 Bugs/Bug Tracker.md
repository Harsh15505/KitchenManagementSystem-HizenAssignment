---
type: tracker
updated: 2026-10-03 01:30 IST
---

# 🐞 Bug Tracker

Log **every** bug here the moment it's found, even if it's fixed in the same minute. A non-trivial bug also gets its own note `04 Bugs/BUG-### <title>.md` (from `_templates/Bug Template.md`). Every fix ships with a regression test named `BUG-### …`.

## Severity

| Sev | Meaning | Examples |
|---|---|---|
| **S1** | Wrong money, wrong cut-off, data corruption, security hole, a reviewer account can't sign in | Total ≠ Σ lines; driver sees others' drops |
| **S2** | A Must flow broken or a business rule not enforced | Order can be edited after cut-off |
| **S3** | Degraded UX or a Should feature broken; workaround exists | Filter resets on refresh |
| **S4** | Cosmetic | Misaligned badge |

## Index

| ID | Title | Sev | Status | Area | Found (IST, by) | Fixed in | Regression test |
|---|---|---|---|---|---|---|---|
| BUG-001 | Admin saw an always-empty "My deliveries today" (admin role granted `dashboard.driver`) | S4 | fixed | shared/authz | 2026-10-03 05:42, Claude (browser check) | T-205 commit | `rules.test.ts` admin cannot read DriverDashboard |
| BUG-002 | Whole UI rendered in a serif fallback font: shadcn init wrote `--font-sans: var(--font-sans)` (a cycle) | S4 | fixed | frontend | 2026-10-03 05:38, Claude (browser check) | T-205 commit | manual (computed font = Geist) |
| BUG-003 | Any partial PATCH of a dish or option reset its defaulted fields (deactivating wiped station, description, allergens, tags, size extras): Zod 4 still applies `.default()` inside `.partial()` | S2 | fixed | shared | 2026-10-03 06:15, Claude (browser check: station showed Unassigned after Deactivate) | fix(shared) commit | `shared/src/contracts/catalogue.test.ts` BUG-003 ×3 |
| BUG-004 | Dish and option lists crashed for kitchen (`formatUsd(undefined)`): the API redacts `*Cents` for roles without `money.read`, the UI still formatted them. Caught before commit | S2 | fixed | frontend | 2026-10-03 06:20, Claude (browser check as kitchen) | T-302 commit | manual (kitchen sees no cost column) |

Status values: `open` · `in-progress` · `fixed` · `won't fix (reason)`.
