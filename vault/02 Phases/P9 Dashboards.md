---
type: phase
id: P9
status: done
estimate: 3h
target: CP5 Sun 4 Oct 20:30 IST (with P10)
---

# P9: Dashboards

**Goal:** every role lands on a dashboard that helps them decide or act. Every figure is computed **exactly** as defined in PRD §8.

Specs: PRD FR-DSH-*, §8 (definitions are binding; if the implementation changes, update PRD §8 and log an ADR)

## Tasks

- [x] **T-901** Admin: today's orders/meals, delivery progress, on-time (today, 7 days), late now, next cut-off with drafts/placed, pending processing (+ Run), 7-day pipeline, booked revenue, uninvoiced, open invoices, paid in 30 days, setup gaps.
- [x] **T-902** Kitchen: production status per station, next deadlines, late/at risk, prep summary, allergen watch, tomorrow.
- [x] **T-903** Dispatch: drops by stage, late/at risk, no driver, next departures, driver load, on-time today.
- [x] **T-904** Driver: my drops today, next stop, on-time today (+ list).
- [x] **T-905** Figure-verification test on seeded data (recompute each figure with an independent query); copy the final definitions into [[README Outline]].

## Exit criteria

- [x] Each figure matches its definition (cancelled/rejected excluded unless stated; "—" for empty ratios) (T-905 cross-check 12:05)
- [x] "What we chose not to show" is listed per dashboard (README §7)

## Log

- 2026-10-03 12:05: P9 done. Admin: `dashboard/dashboard.service.ts` (`GET /dashboard/admin`) reuses the kitchen board, dispatch board, cut-off overview and billing summary, plus grouped queries for the window (orders/money via groupBy, meals via one SQL sum) and the setup gaps (dishes on active menu items unpriced on a tier in use, companies without a default driver, dishes without a station). Kitchen/dispatch/driver dashboards are computed in the browser from their boards (one source of truth with the boards); the kitchen board gained `containsAllergenIds` and `pending` (placed meals before the cut-off). UI: `/dashboard` with tabs per section the user may read. T-905: every admin figure recomputed through other endpoints on Neon (orders 8=8, meals 12=12, drops 3/1=3/1, open invoices 5/$1,426.03 both ways, uninvoiced $1,428.84 both ways, tomorrow's placed 0=0). Definitions stay in PRD §8 for the README.

## Outcome

Done 2026-10-03 12:05 (CP5 target Sun 20:30).
- Built: admin dashboard from one endpoint; kitchen, dispatch and driver dashboards computed from their boards. Rebuilt 2026-10-03 17:22 with charts (revenue, on-time, pipeline), count-up figures, cut-off countdown, station progress, deadline timeline, stage pipeline and driver load (ADR-028); figures and definitions unchanged.
- Cut: profit/margin and per-employee spend (reasons in README §7). Bug: do-not-cook items sat in the Tomorrow panel (BUG-010, fixed da6be4f).
- Follow-ups: none.
