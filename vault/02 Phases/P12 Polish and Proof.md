---
type: phase
id: P12
status: in-progress
estimate: 8h
target: code freeze Sun 4 Oct 20:00 IST (submission CP6 22:30)
---

# P12: Polish and proof

**Goal:** with every Must live, spend the remaining time where reviewers look: a finished-looking UI, numbers behind the "fast at 400 orders" and "concurrency safe" claims, and the cheap Shoulds. No risky changes after the freeze.

Specs: brief §7 (quality bar) · `docs/PRD.md` FR-CMP-05, NFR-03, NFR-05 · ADR-028, ADR-029 · [[Submission Checklist]]

## Tasks

- [x] **T-1201** Brand theme and dark mode toggle (ADR-028). *Accept:* tokens only, both themes readable, preference remembered.
- [x] **T-1202** Dashboards rebuilt: charts, count-up figures, cut-off countdown, station progress, stage pipeline, driver load; figures unchanged (README §7).
- [x] **T-1203** Boards and detail screens: kitchen unit cards, dispatch stage stepper, driver progress, order lifecycle stepper and timeline rail, billing metric cards, consistent filter chips.
- [x] **T-1204** Theme switch animation (View Transitions circular reveal; instant under reduced motion).
- [ ] **T-409** *(Should)* Holiday conflict warning → [[P4 Companies and Employees]].
- [ ] **T-1205** Form screens design pass: order builder, new/edit company, employee, dish/option editors, settings. *Accept:* same card/heading/spacing language as the boards; errors still inline; works at phone width.
- [ ] **T-605** 400-order kitchen board perf on a throwaway Neon branch → [[P6 Kitchen Board]]. *Accept:* p50/p95 for `GET /kitchen/board` logged in the P6 note and README §11.
- [ ] **T-1206** Concurrency + integrity script on the same throwaway branch: two simultaneous "done" clicks, two simultaneous invoices for one company, cut-off run twice, company integrity (owner + default address). *Accept:* `pnpm --filter @fernleaf/backend probe:concurrency` prints pass/fail per check; README §11 updated.
- [ ] **T-1207** README final pass + screenshots (light and dark).
- [ ] **T-406** *(Should, only if ahead by Sun 15:00)* CSV import → [[P4 Companies and Employees]].

## Exit criteria

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, frontend build clean; CI green
- [ ] Perf and concurrency numbers written down (or the gap stated honestly in the README)
- [ ] Code frozen by Sun 20:00 IST; live app checked after the last deploy

## Risks

- Every push to `main` redeploys the live app (Vercel + Render). Push in few, tested commits (owner asked for fewer commits, 2026-10-03 18:33).
- Local dev writes to the production database (ADR-029): delete probe data; bulk scripts only on the throwaway branch.

## Log

- 2026-10-03 15:40–18:00: T-1201…T-1204 done (3034119, 9d9525c, 3f92e86, 3a77ded, 9c6e749).
- 2026-10-03 18:55: Phase opened from the owner-approved plan; vault caught up first (owner's instruction).

## Outcome
