---
type: phase
id: P6
status: not-started
estimate: 3h
target: CP4 Sun 4 Oct 16:30 IST (with P7, P8)
---

# P6: Kitchen board

**Goal:** the kitchen sees prep units for a date by station and time slot, marks them started/done safely under concurrency, and late or at-risk work is unmistakable. It stays fast at 400 orders.

Specs: PRD FR-KIT-*, BR-KIT-*, BR-PLN-*, §8.3 · TRD §8.5, §8.8, §10 · ARCHITECTURE §7.3

## Tasks

- [ ] **T-601** `GET /kitchen/board?date&stationId`: single narrow query; units grouped by station and planned kitchen-ready slot; timeliness per unit; summary counts; prep summary (station → dish → combination → Σ qty); allergen flags (dish ∪ options vs employee allergies).
- [ ] **T-602** `POST /kitchen/units/:id/start|done` with the order row lock + conditional updates; order `kitchenStartedAt` / `kitchenReadyAt`; events; **integration race test** (two "done" calls → one 200, one 409) + **tests BR-KIT-01…05**.
- [ ] **T-603** `POST /kitchen/orders/:id/force-complete` (admin, `kitchen.forceComplete`).
- [ ] **T-604** Kitchen board UI: date + station chips with counts, summary strip, slot groups, unit cards (dish, combination, qty, order #, employee, allergen badges), big Start/Done, LATE (red) / AT RISK (amber), optimistic updates + 409 toasts, 15 s polling, *(Should)* do-not-cook section.
- [ ] **T-605** Perf: `scripts/perf-kitchen-board.ts` generates a 400-order day on the dev branch; record p50/p95 API time and render time in this note.

## Exit criteria

- [ ] Only confirmed orders can be worked; no double start/finish; finish-without-start records the start
- [ ] Kitchen-ready is set only when all units are done
- [ ] Perf numbers logged (target: API p95 < 800 ms on Render free, first render < 1.5 s)

## Log

## Outcome
