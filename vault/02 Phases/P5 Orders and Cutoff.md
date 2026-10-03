---
type: phase
id: P5
status: done
estimate: 6.5h
target: CP3 Sun 4 Oct 10:00 IST
---

# P5: Orders and cut-off

**Goal:** staff create orders for employees through the full flow, with every rule validated on the server. Statuses and edits respect the cut-off. Cut-off processing is automatic, idempotent and manually triggerable. The order list and detail are complete. Generated demo orders exist for the boards.

Specs: PRD FR-ORD-*, BR-CAL/CUT/ORD/CMB/PLN, A-14…A-21, A-36, A-40 · TRD §8.1, §8.3, §8.5–8.7, §5.10 · ARCHITECTURE §7.1–7.2

## Tasks

- [x] **T-501** Schema: Order, OrderLine, OrderCombination, OrderCombinationChoice, OrderEvent, CutoffRun, Drop (base) + CHECKs + indexes.
- [x] **T-502** `shared/domain/cutoff.ts` + deliverability (`BR-CAL-01`) + **tests BR-CUT-01…03** (Wed/N=2 → Mon 16:00; holidays skipped; N=0; boundary instant; TZ matrix).
- [x] **T-503** `shared/domain/combinations.ts`: normalise/validate/signature/merge/price + capture-on-edit + **tests BR-CMB-*, BR-MNY-02, BR-PRC-07** (6 + 4 = 10 example).
- [x] **T-504** `GET /orders/context`: deliverable dates (21 days) with `cutoffAt`, flags → allowed address/time/packaging, defaults, employee menu.
- [x] **T-505** `POST /orders/quote`: full validation + pricing without persisting; field-path errors; warnings (allergens, min qty).
- [x] **T-506** `POST /orders` (DRAFT/PLACE): TX insert with totals, plans, snapshots, events; **late admin order → CONFIRMED + drop**; time-based lock (`ORDER_LOCKED`).
- [x] **T-507** Order builder UI (TRD §7.3): employee → date → menu → combinations → delivery → breakdown → draft/place; inline server errors.
- [x] **T-508** Edit (`PUT`, version → 409), place, cancel, reject (+ reason); billing hook placeholder for invoiced orders (completed in T-804).
- [x] **T-509** Cut-off processing service (advisory lock, `updateManyAndReturn`, replan, drop upsert with default driver, events, CutoffRun) + **integration tests: idempotent re-run, concurrent runs, future cut-off → 422**.
- [x] **T-510** JobsService (timer for the next cut-off, bootstrap and request catch-up, `autoCutoffEnabled`) + Cut-off page UI (lock times, pending dates, run history, **Run now**).
- [x] **T-511** Orders list API + UI: server pagination/sort; search (number, employee, company); filters (date range, status multi, company, invoiced); URL state.
- [x] **T-512** Order detail UI (lines, choices, money breakdown, delivery, plans vs actuals, drop/driver, invoice, timeline) + **admin delivery override** (`PATCH /orders/:id/delivery`: replan + drop move, BR-DSP-06).
- [x] **T-513** Demo generator v1: rolling window −14…+7 with every status (TRD §12), so P6–P9 have data.

## Exit criteria

- [x] All Must order rules enforced server-side, with actionable errors in the UI (shared domain tests BR-CUT/BR-CMB; builder shows field errors)
- [x] Manual cut-off run twice → the second run logs 0/0 (Neon probe 10:42; re-checked in the live smoke test T-1006; repeatable in T-1206)
- [x] Orders in every status exist across past, today and the next 7 days (demo window, 702 orders)

## Log

- 2026-10-03 07:16: T-501 (schema came with the init migration), T-502 `domain/cutoff.ts` (cutoffAt, isLocked, deliverability, planTimes, timeliness, slots; tests under 3 TZs), T-503 `domain/combinations.ts` (normaliseOrder with field paths, merge, pricing, warnings, capture-on-edit; ADR-027 signature by ids).
- 2026-10-03 10:42: Backend `orders` module: `PlanningService` (kitchen calendar + settings); `drops.ts` (upsert on company/address/instant with the default driver, strict checks for overrides, empty-drop cleanup); `OrdersService` (context, quote, create incl. admin late orders that go straight to CONFIRMED with a drop, edit with versions and price capture, place re-validates, cancel/reject with reasons, delivery override); `OrdersQueryService` (list with search/filters/sort, detail with derived stage and allowed actions); `CutoffService` (advisory lock, updateManyAndReturn, re-plan, drops, events, run log, catch-up, overview); `JobsService` (timer for the next cut-off capped at 6 h, startup and throttled request catch-up, extra-task hook). Neon probe green; probe data deleted, order number sequence reset.
- 2026-10-03 10:49: Frontend: builder (`orders/order-builder.tsx`), list (URL filters), detail (actions, override form, timeline), edit page, `/cutoff`.
- 2026-10-03 10:54: T-513 `demo/demo.service.ts`: rolling window -14..+7 (one DemoDay claim per date), batch inserts, statuses by relative date, full timestamps and timelines, per-drop autopilot caps; the autopilot closes past days. First run: 702 orders, 113 drops. Invoices come with P8.
- Gaps to revisit: no automated DB-backed cut-off concurrency test (verified by probe); a settings change re-arms the timer only through the 5-minute request catch-up.

## Outcome

Done 2026-10-03 10:54 (CP3 target Sun 10:00).
- Built: cut-off calculator and lock, combinations engine with price capture, order builder with live quotes, edit/place/cancel/reject, admin late orders and delivery override, idempotent cut-off processing with an advisory lock, timers + catch-up, list/detail, rolling demo window with autopilot.
- Cut: nothing. Gap: race behaviour is verified by probes, not automated (→ T-1206).
- Follow-ups: T-1206.
