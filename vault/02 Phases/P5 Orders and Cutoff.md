---
type: phase
id: P5
status: not-started
estimate: 6.5h
target: CP3 Sun 4 Oct 10:00 IST
---

# P5: Orders and cut-off

**Goal:** staff create orders for employees through the full flow, with every rule validated on the server. Statuses and edits respect the cut-off. Cut-off processing is automatic, idempotent and manually triggerable. The order list and detail are complete. Generated demo orders exist for the boards.

Specs: PRD FR-ORD-*, BR-CAL/CUT/ORD/CMB/PLN, A-14…A-21, A-36, A-40 · TRD §8.1, §8.3, §8.5–8.7, §5.10 · ARCHITECTURE §7.1–7.2

## Tasks

- [ ] **T-501** Schema: Order, OrderLine, OrderCombination, OrderCombinationChoice, OrderEvent, CutoffRun, Drop (base) + CHECKs + indexes.
- [ ] **T-502** `shared/domain/cutoff.ts` + deliverability (`BR-CAL-01`) + **tests BR-CUT-01…03** (Wed/N=2 → Mon 16:00; holidays skipped; N=0; boundary instant; TZ matrix).
- [ ] **T-503** `shared/domain/combinations.ts`: normalise/validate/signature/merge/price + capture-on-edit + **tests BR-CMB-*, BR-MNY-02, BR-PRC-07** (6 + 4 = 10 example).
- [ ] **T-504** `GET /orders/context`: deliverable dates (21 days) with `cutoffAt`, flags → allowed address/time/packaging, defaults, employee menu.
- [ ] **T-505** `POST /orders/quote`: full validation + pricing without persisting; field-path errors; warnings (allergens, min qty).
- [ ] **T-506** `POST /orders` (DRAFT/PLACE): TX insert with totals, plans, snapshots, events; **late admin order → CONFIRMED + drop**; time-based lock (`ORDER_LOCKED`).
- [ ] **T-507** Order builder UI (TRD §7.3): employee → date → menu → combinations → delivery → breakdown → draft/place; inline server errors.
- [ ] **T-508** Edit (`PUT`, version → 409), place, cancel, reject (+ reason); billing hook placeholder for invoiced orders (completed in T-804).
- [ ] **T-509** Cut-off processing service (advisory lock, `updateManyAndReturn`, replan, drop upsert with default driver, events, CutoffRun) + **integration tests: idempotent re-run, concurrent runs, future cut-off → 422**.
- [ ] **T-510** JobsService (timer for the next cut-off, bootstrap and request catch-up, `autoCutoffEnabled`) + Cut-off page UI (lock times, pending dates, run history, **Run now**).
- [ ] **T-511** Orders list API + UI: server pagination/sort; search (number, employee, company); filters (date range, status multi, company, invoiced); URL state.
- [ ] **T-512** Order detail UI (lines, choices, money breakdown, delivery, plans vs actuals, drop/driver, invoice, timeline) + **admin delivery override** (`PATCH /orders/:id/delivery`: replan + drop move, BR-DSP-06).
- [ ] **T-513** Demo generator v1: rolling window −14…+7 with every status (TRD §12), so P6–P9 have data.

## Exit criteria

- [ ] All Must order rules enforced server-side, with actionable errors in the UI
- [ ] Manual cut-off run twice → the second run logs 0/0
- [ ] Orders in every status exist across past, today and the next 7 days

## Log

## Outcome
