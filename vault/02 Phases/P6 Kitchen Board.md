---
type: phase
id: P6
status: done (T-605 perf script not run)
estimate: 3h
target: CP4 Sun 4 Oct 16:30 IST (with P7, P8)
---

# P6: Kitchen board

**Goal:** the kitchen sees prep units for a date by station and time slot, marks them started/done safely under concurrency, and late or at-risk work is unmistakable. It stays fast at 400 orders.

Specs: PRD FR-KIT-*, BR-KIT-*, BR-PLN-*, §8.3 · TRD §8.5, §8.8, §10 · ARCHITECTURE §7.3

## Tasks

- [x] **T-601** `GET /kitchen/board?date&stationId`: single narrow query; units grouped by station and planned kitchen-ready slot; timeliness per unit; summary counts; prep summary (station → dish → combination → Σ qty); allergen flags (dish ∪ options vs employee allergies).
- [x] **T-602** `POST /kitchen/units/:id/start|done` with the order row lock + conditional updates; order `kitchenStartedAt` / `kitchenReadyAt`; events; **integration race test** (two "done" calls → one 200, one 409) + **tests BR-KIT-01…05**.
- [x] **T-603** `POST /kitchen/orders/:id/force-complete` (admin, `kitchen.forceComplete`).
- [x] **T-604** Kitchen board UI: date + station chips with counts, summary strip, slot groups, unit cards (dish, combination, qty, order #, employee, allergen badges), big Start/Done, LATE (red) / AT RISK (amber), optimistic updates + 409 toasts, 15 s polling, *(Should)* do-not-cook section.
- [ ] **T-605** Perf: `scripts/perf-kitchen-board.ts` generates a 400-order day on the dev branch; record p50/p95 API time and render time in this note.

## Exit criteria

- [x] Only confirmed orders can be worked; no double start/finish; finish-without-start records the start (`kitchen.test.ts` BR-KIT-01/02; Neon race 200 + 409)
- [x] Kitchen-ready is set only when all units are done (BR-KIT-03)
- [ ] Perf numbers logged (target: API p95 < 800 ms on Render free, first render < 1.5 s)

## Log

- 2026-10-03 11:05: P6 done. `kitchen/kitchen.service.ts`: board from one order query (units = combinations of CONFIRMED/DELIVERED orders, plus "do not cook" for cancelled/rejected orders with started work), station chips with counts, slots by planned kitchen-ready, timeliness vs the order plan, allergen flags (dish + options vs employee allergies), prep summary. Start/done/force-complete lock the order row (`SELECT … FOR UPDATE`) and use conditional updates; kitchen-ready only when no unit is left; any human action clears `demoAutopilotUntil`. Tests: `kitchen.test.ts` (6, BR-KIT-01..04 + autopilot). Neon: concurrent "done" → 200 + 409 `UNIT_ALREADY_DONE`; force-complete 403 for kitchen. UI `/kitchen` (station chips, summary strip, slot groups, big Start/Done, LATE/AT RISK, optimistic updates, 15 s polling, prep summary view).
- Perf (T-605, partial): board API for a 48-order/67-unit day: ~570–590 ms from this laptop (India) to Neon Singapore; time is dominated by round trips (auth lookup + 4 parallel queries). On Render (same region as Neon) expect well under the 800 ms target. The 400-order synthetic script was not written (time).
- Test harness: the permission-matrix fake Prisma now returns lazy failing thenables for unknown models (real Prisma queries are lazy too), which removed unhandled rejections.

## Outcome

Done 2026-10-03 11:05 except T-605 (CP4 target Sun 16:30).
- Built: board by slot and station with late/at-risk, allergen flags, do-not-cook cards, prep summary, start/done/force-complete with row locks, optimistic UI, 15 s polling. Redesigned 2026-10-03 17:27 (status stripe, slot progress, ADR-028).
- Cut: none yet. T-605 (400-order perf numbers) is scheduled for Sun 4 Oct morning on a throwaway Neon branch (ADR-029).
- Follow-ups: T-605.
