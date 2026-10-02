---
type: phase
id: P9
status: not-started
estimate: 3h
target: CP5 Sun 4 Oct 20:30 IST (with P10)
---

# P9: Dashboards

**Goal:** every role lands on a dashboard that helps them decide or act. Every figure is computed **exactly** as defined in PRD §8.

Specs: PRD FR-DSH-*, §8 (definitions are binding; if the implementation changes, update PRD §8 and log an ADR)

## Tasks

- [ ] **T-901** Admin: today's orders/meals, delivery progress, on-time (today, 7 days), late now, next cut-off with drafts/placed, pending processing (+ Run), 7-day pipeline, booked revenue, uninvoiced, open invoices, paid in 30 days, setup gaps.
- [ ] **T-902** Kitchen: production status per station, next deadlines, late/at risk, prep summary, allergen watch, tomorrow.
- [ ] **T-903** Dispatch: drops by stage, late/at risk, no driver, next departures, driver load, on-time today.
- [ ] **T-904** Driver: my drops today, next stop, on-time today (+ list).
- [ ] **T-905** Figure-verification test on seeded data (recompute each figure with an independent query); copy the final definitions into [[README Outline]].

## Exit criteria

- [ ] Each figure matches its definition (cancelled/rejected excluded unless stated; "—" for empty ratios)
- [ ] "What we chose not to show" is listed per dashboard

## Log

## Outcome
