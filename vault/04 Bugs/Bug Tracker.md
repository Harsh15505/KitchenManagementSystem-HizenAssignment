---
type: tracker
updated: 2026-10-03 18:47 IST
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
| BUG-005 | Menu screen didn't flag dishes explicitly "not sold" on the default tier: the check looked for source `MISSING` only, but `EXCLUDED` is just as invisible to employees. Caught before commit | S3 | fixed | backend | 2026-10-03 06:42, Claude (Neon probe) | T-310 commit | manual probe (flag false → true after exclude) |
| BUG-006 | Opening the account menu (top right) crashed the page: "MenuGroupContext is missing". Base UI requires `Menu.GroupLabel` (our `DropdownMenuLabel`) inside a `Menu.Group`; the shell used it bare (Radix allowed that) | S2 | fixed | frontend | 2026-10-03 13:00, owner (local check) | fix(frontend) commit | manual (menu opens, no console error) |

| BUG-007 | Vercel build failed: `@fernleaf/shared` not found, because `shared/dist` is git-ignored and the frontend build didn't build it | S1 | fixed | build | 2026-10-03 12:47, owner (Vercel log) | 0175a3e | CI + Vercel build |
| BUG-008 | CI build failed after BUG-007's fix: the frontend build re-ran the shared build (tsup `clean: true`) while `pnpm -r build` was building the backend against the same `dist` | S2 | fixed | build | 2026-10-03 15:50, owner (CI) | 268744d (`ensure-shared.mjs` builds shared only when `dist/index.d.ts` is missing) | CI green |
| BUG-009 | Demo invoices were issued "today": the backend dev server hot-reloaded half-finished demo code before the backdate patch | S3 | fixed | backend/demo | 2026-10-03 11:40, Claude (Neon probe) | one-off script; regenerate now also deletes invoices holding demo orders | manual |
| BUG-010 | Kitchen dashboard listed today's "do not cook" items inside the Tomorrow panel, which read as tomorrow's work | S3 | fixed | frontend | 2026-10-03 13:58, owner (live screenshots) | da6be4f | manual |
| BUG-011 | The serif page-title underline sat inline next to badges in flex headings (order detail, company page). Caught before commit | S4 | fixed | frontend | 2026-10-03 17:29, Claude (browser check) | 3a77ded | manual |

| BUG-012 | Switching theme in a hidden tab logged "Uncaught (in promise) InvalidStateError": the skipped view transition rejects `ready`, which wasn't caught | S4 | fixed | frontend | 2026-10-03 18:58, Claude (console check) | T-1205 commit (`.catch` on `transition.ready`) | manual (no unhandled rejection; theme still switches) |

| BUG-013 | CI failed on 1f65a6c: `.claude/launch.json` (written by Python `json.dump`) wasn't Prettier-formatted, and CI runs `prettier --check .` | S3 | fixed | tooling | 2026-10-03 22:45, Claude (local `prettier --check`, then the CI run) | next commit (formatted) | CI format step |

Status values: `open` · `in-progress` · `fixed` · `won't fix (reason)`.
