---
type: phase
id: P7
status: done
estimate: 3.5h
target: CP4 Sun 4 Oct 16:30 IST
---

# P7: Dispatch board and driver view

**Goal:** dispatch works with drops (company + address + exact time), assigns drivers and moves drops through the stages; drivers deliver from a phone with a note and photo; on-time is recorded.

Specs: PRD FR-DSP-*, BR-DSP-*, §8.4–8.5, A-22…A-24 · TRD §8.6, §5.11 · ARCHITECTURE §7.4

## Tasks

- [x] **T-701** Drop service: key, upsert on unique key (default driver), stage derivation, **override move rules (BR-DSP-06)**, delete empty undispatched drops.
- [x] **T-702** Dispatch API: board (drops by time, readiness x/y, stage, driver, timeliness), drivers list (`delivery.perform`), assign driver, dispatch-ready (all kitchen-ready), out for delivery (needs driver), delivered (dispatch fallback) + **tests BR-DSP-01…05**.
- [x] **T-703** Dispatch board UI: grouped by delivery time; stage/driver filters; driver select; next-step buttons; late/at-risk badges; 15 s polling.
- [x] **T-704** Driver API: `GET /driver/drops` (own + today only), `POST /driver/drops/:id/delivered` (own, out for delivery; note + photo; `deliveredOnTime`) + **scoping tests** (another driver's drop → 404/403).
- [x] **T-705** Driver mobile UI: "Next stop" hero, time-ordered cards (address, maps link, instructions, packaging, boxes, recipients), Mark-delivered sheet with note + camera input + client compression.
- [x] **T-706** Photo storage (`DeliveryPhoto` bytea, 5 MB raw limit, MIME whitelist) + `GET /drops/:id/photo` with scope checks.

## Exit criteria

- [x] A step can't be skipped or repeated; out-for-delivery without a driver is refused (`dispatch.test.ts` BR-DSP-02/03/04)
- [x] driver@test.com sees only their own drops for today; it works on a phone viewport (BR-DSP-07; Neon probe; phone-width check 05:45 and in the live smoke test)
- [x] On-time stored at delivery (BR-DSP-05)

## Log

- 2026-10-03 11:20: P7 done. T-701 was largely P5's `orders/drops.ts` (key, upsert with default driver, strict override rules, empty-drop cleanup). `dispatch/dispatch.service.ts`: board (drops for a day with stage COOKING/KITCHEN_READY/DISPATCH_READY/OUT_FOR_DELIVERY/DELIVERED, readiness, boxes, timeliness vs the earliest planned dispatch-ready, filters, summary), assign/clear driver until out, markReady (all active orders cooked), markOut (driver required), deliver (driver: own + today, else 404; dispatch fallback), on-time stored once, events on every order, drop row lock, demo autopilot handed over. Photos: `DeliveryPhoto` bytea, JPEG/PNG/WebP, 5 MB raw, base64 JSON (body limit 8 MB), `GET /drops/:id/photo` for dispatch or the drop's driver. Tests `dispatch.test.ts` (5). Neon probe: packing a cooking drop refused, driver sees own drops only, delivery with note + photo, repeat refused, photo served. UI: `/dispatch` (stage chips, driver picker, next-step buttons) and `/driver` (phone-first, next stop, maps link, compression in the browser). Nav: "My deliveries" keys on `dashboard.driver`, so admins/dispatch don't get a driver menu.

## Outcome

Done 2026-10-03 11:20 (CP4 target Sun 16:30).
- Built: drops per company/address/time with default drivers, dispatch board with stages and readiness, driver assignment, packed → out → delivered with row locks, the driver's phone view with notes and compressed photos, on-time stored once. Redesigned 17:27 (stage stepper, readiness bars).
- Cut: nothing.
- Follow-ups: none.
