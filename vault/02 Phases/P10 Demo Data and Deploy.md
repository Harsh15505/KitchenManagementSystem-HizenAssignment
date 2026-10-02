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

- [ ] **T-1001** Static seed complete and idempotent: staff, roles, settings, reference, catalogue, tiers and prices, menu, companies, employees ([[Demo Data Plan]]).
- [ ] **T-1002** Rolling window `ensureWindow(now)` + `DemoDay`; bootstrap, nightly (00:05 IST) and catch-up triggers; close past days; past invoices (paid/issued); last 7 days uninvoiced.
- [ ] **T-1003** *(Should)* Autopilot: per-order `demoAutopilotUntil` caps (same per drop), expected-stage computation, advance through the domain services with system actor "Demo autopilot" and scheduled timestamps; human action clears the cap; Settings toggle.
- [ ] **T-1004** *(Should)* `POST /demo/regenerate` + Settings → Demo data page (status, last generated, regenerate).
- [ ] **T-1005** Production: run migrations, seed, verify the 4 logins, role isolation (403s), today's data in every role, driver drops today, cut-off manual run, driver flow on a real phone.
- [ ] **T-1006** Run the live smoke checklist ([[Submission Checklist]]); record Neon CU-hours and Render hours in [[Environments and Deploy]].

## Exit criteria

- [ ] Opening the live app at any hour shows: past, today and next-week orders; each role has something to do; driver@test.com has drops today
- [ ] A reviewer-created order is never deleted by automation

## Log

## Outcome
