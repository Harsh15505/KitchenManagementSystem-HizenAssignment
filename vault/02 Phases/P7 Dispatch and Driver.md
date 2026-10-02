---
type: phase
id: P7
status: not-started
estimate: 3.5h
target: CP4 Sun 4 Oct 16:30 IST
---

# P7: Dispatch board and driver view

**Goal:** dispatch works with drops (company + address + exact time), assigns drivers and moves drops through the stages; drivers deliver from a phone with a note and photo; on-time is recorded.

Specs: PRD FR-DSP-*, BR-DSP-*, §8.4–8.5, A-22…A-24 · TRD §8.6, §5.11 · ARCHITECTURE §7.4

## Tasks

- [ ] **T-701** Drop service: key, upsert on unique key (default driver), stage derivation, **override move rules (BR-DSP-06)**, delete empty undispatched drops.
- [ ] **T-702** Dispatch API: board (drops by time, readiness x/y, stage, driver, timeliness), drivers list (`delivery.perform`), assign driver, dispatch-ready (all kitchen-ready), out for delivery (needs driver), delivered (dispatch fallback) + **tests BR-DSP-01…05**.
- [ ] **T-703** Dispatch board UI: grouped by delivery time; stage/driver filters; driver select; next-step buttons; late/at-risk badges; 15 s polling.
- [ ] **T-704** Driver API: `GET /driver/drops` (own + today only), `POST /driver/drops/:id/delivered` (own, out for delivery; note + photo; `deliveredOnTime`) + **scoping tests** (another driver's drop → 404/403).
- [ ] **T-705** Driver mobile UI: "Next stop" hero, time-ordered cards (address, maps link, instructions, packaging, boxes, recipients), Mark-delivered sheet with note + camera input + client compression.
- [ ] **T-706** Photo storage (`DeliveryPhoto` bytea, 5 MB raw limit, MIME whitelist) + `GET /drops/:id/photo` with scope checks.

## Exit criteria

- [ ] A step can't be skipped or repeated; out-for-delivery without a driver is refused
- [ ] driver@test.com sees only their own drops for today; it works on a phone viewport
- [ ] On-time stored at delivery

## Log

## Outcome
