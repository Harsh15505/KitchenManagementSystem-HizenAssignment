---
type: phase
id: P10
status: not-started
estimate: 3h
target: CP5 Sun 4 Oct 20:30 IST
---

# P10: Demo data and production hardening

**Goal:** the live app has realistic data **on any review day** without manual work. Production is verified against the reviewers' path.

Specs: PRD FR-DAT-*, A-02, A-31 · TRD §12, §13 · [[Demo Data Plan]] · [[Environments and Deploy]]

## Tasks

- [x] **T-1001** Static seed complete and idempotent: staff, roles, settings, reference, catalogue, tiers and prices, menu, companies, employees ([[Demo Data Plan]]).
- [x] **T-1002** Rolling window `ensureWindow(now)` + `DemoDay`; bootstrap, nightly (00:05 IST) and catch-up triggers; close past days; past invoices (paid/issued); last 7 days uninvoiced.
- [x] **T-1003** *(Should)* Autopilot: per-order `demoAutopilotUntil` caps (same per drop), expected-stage computation, advance through the domain services with system actor "Demo autopilot" and scheduled timestamps; human action clears the cap; Settings toggle.
- [x] **T-1004** *(Should)* `POST /demo/regenerate` + Settings → Demo data page (status, last generated, regenerate).
- [x] **T-1005** Production: run migrations, seed, verify the 4 logins, role isolation (403s), today's data in every role, driver drops today, cut-off manual run, driver flow on a real phone.
- [ ] **T-1006** Run the live smoke checklist ([[Submission Checklist]]); record Neon CU-hours and Render hours in [[Environments and Deploy]].

## Exit criteria

- [ ] Opening the live app at any hour shows: past, today and next-week orders; each role has something to do; driver@test.com has drops today
- [ ] A reviewer-created order is never deleted by automation

## Log

- 2026-10-03 15:35: Deployed. API https://fernleaf-api-l0yq.onrender.com (health + DB ready green, Neon 3–37 ms from Render). Web https://ktichen-management-hizen.vercel.app. Vercel build first failed because `shared/dist` is git-ignored: frontend `build` now runs `pnpm --filter @fernleaf/shared build` first (0175a3e). Render `WEB_ORIGIN` set to the Vercel domain; origin check verified (wrong login → 401, not 403). Owner added the UptimeRobot monitor on `/api/health` and signed in with all 4 accounts: dashboards correct and each role sees only its navigation. Follow-up UI fix: "Do not cook" moved out of the Tomorrow panel.

- 2026-10-03 12:15: T-1001 (static seed complete, idempotent), T-1002/T-1003 (rolling window + autopilot, built in P5 as T-513; weekly invoices added in P8) and T-1004 (`GET /demo/status`, Settings → Demo data card with Regenerate) done. Settings saves re-arm the cut-off timer. Production build passes (`pnpm -r build`). T-1005/T-1006 wait for the Render service (owner).

## Outcome
