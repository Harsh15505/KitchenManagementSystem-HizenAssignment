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
- [x] **T-409** *(Should)* Holiday conflict warning → [[P4 Companies and Employees]].
- [x] **T-1205** Form screens design pass: order builder, new/edit company, employee, dish/option editors, settings. *Accept:* same card/heading/spacing language as the boards; errors still inline; works at phone width.
- [x] **T-605** 400-order kitchen board perf on a throwaway Neon branch → [[P6 Kitchen Board]]. *Accept:* p50/p95 for `GET /kitchen/board` logged in the P6 note and README §11.
- [x] **T-1206** Concurrency + integrity script on the same throwaway branch: two simultaneous "done" clicks, two simultaneous invoices for one company, cut-off run twice, company integrity (owner + default address). *Accept:* `pnpm --filter @fernleaf/backend probe:concurrency` prints pass/fail per check; README §11 updated.
- [x] **T-1207** README final pass + screenshots (light and dark), perf and concurrency numbers in §11.
- [x] **T-406** *(Should)* CSV import → [[P4 Companies and Employees]].
- [x] **T-1208** First-glance dashboards for all four roles (ADR-032). *Accept:* the role's key figures visible without scrolling at 1440×900 (driver at 375 px); figures defined in PRD §8.
- [x] **T-1209** README restructured: bullets over dense text; §7 dashboards per role with what/why, exact calculation and what is not shown. Built Saturday evening (owner: push everything today).

## Exit criteria

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, frontend build clean; CI green (after the BUG-013 fix)
- [x] Perf and concurrency numbers written down (README §11)
- [ ] Code frozen by Sun 20:00 IST; live app checked after the last deploy

## Risks

- Every push to `main` redeploys the live app (Vercel + Render). Push in few, tested commits (owner asked for fewer commits, 2026-10-03 18:33).
- Local dev writes to the production database (ADR-029): delete probe data; bulk scripts only on the throwaway branch.

## Log

- 2026-10-03 15:40–18:00: T-1201…T-1204 done (3034119, 9d9525c, 3f92e86, 3a77ded, 9c6e749).
- 2026-10-03 18:47: Phase opened from the owner-approved plan; vault caught up first (owner's instruction).

- 2026-10-03 18:55: T-409 done (company + kitchen holidays). Tests 322 (113 shared, 209 backend).

- 2026-10-03 19:02: T-1205 done. Inputs and selects everywhere: card background, 36 px height, hover border; card titles semibold serif. Order builder: numbered steps that tick when complete (shared `StepTitle`), dish and combination cards, chip-style multi-select, dashed "add a dish" area, a checklist while incomplete, error with icon, animated total. New company: numbered steps with descriptions. Company form section headings with dividers. Label spacing 6 px. Verified: builder to a live quote (Lumen, Paneer Tikka Rice Bowl $5.20, nothing saved), new company page renders, typecheck/lint/build clean. Found BUG-012 (theme reveal unhandled rejection on hidden tabs), fixed.

- 19:35: T-605 and T-1206 scripts written (`backend/scripts/perf-harness.ts`, `perf-kitchen-board.ts`, `probe-concurrency.ts`; `pnpm … perf:kitchen` / `probe:concurrency`). The harness starts the built API on :4100 against `backend/.env.perf` and refuses the live endpoint (verified: missing file → clear message). Waiting on O-05 to run them.
- 2026-10-03 19:57: T-406 done. Tests 328 (118 shared, 210 backend); frontend build clean.

- 2026-10-03 20:03: T-1207 mostly done: README screenshots (admin dashboard light + dark, kitchen board, dispatch board; captured from the production build on :3002 at 1440×900 so the dev badge is absent), tour mentions holiday warning, CSV import and dark mode; ADR-028/029 in §8; §9 says all Shoulds are built, the CI race-test gap and next steps; §11 has 328 tests and the two scripts; §13 mentions P12.

- 2026-10-03 22:45: Owner created the `perf` branch from `dev` (auto-delete after 1 day) and shared its URL (fine to have in chat, owner's call); in `backend/.env.perf`. `probe:concurrency` 9/9. `perf:kitchen` first run created only 167 orders (default deliveries already left) and showed the board at 1.3 s → script now skips those employees and gives time-flexible employees late slots; baseline at 400 orders 1525 ms → ADR-030 `relationJoins` → 584 ms, verified by identical JSON on 42 endpoints and 9/9 again. CI had failed on 1f65a6c (unformatted `.claude/launch.json`, BUG-013), fixed in this commit.

- 2026-10-04 14:35: Owner feedback on screenshots: (1) throttled login showed a raw exception name → friendly 429 message (BUG-014); (2) SKU: researched (Square generates, Toast doesn't, Shopify via apps), decided to generate when blank (ADR-031, `nextSku`, retry on collision); (3) dishes, options and companies lists got Edit and Deactivate/Reactivate buttons in each row (BUG-015; the employees overview page stays read-only, its actions live on the company page). Tests 336 (122 shared, 214 backend); frontend build clean.

- 2026-10-04 18:25: Owner feedback round 2: new favicon (SVG + apple icon + ICO), admin and kitchen dashboards rebuilt as bento (hero, tinted and plain cards, ring), floating-text fix with `DetailList` (BUG-016). Verified in the browser at 1280 px: admin dashboard, kitchen dashboard, cut-off page, order detail; typecheck, lint, 336 tests clean. Untracked `prep/` folder (owner's, not committed) fails `prettier --check .` (html/json): format it or add it to `.prettierignore` before committing it.

- 2026-10-04 19:05: T-1208 + T-1209 done. Kitchen, dispatch, driver and admin dashboards rebuilt around one question each and fit one screen (checked 1440×900, 1366×768, driver 375 px, dark mode). `prepSummary` moved to shared with meals left (4 FR-KIT-06 tests). PRD §8 and README fully rewritten (README: bullets, per-dashboard what/why/how/not shown, conventions). New screenshots (admin light/dark, kitchen dashboard) from the production build. Found: kitchen working days are Mon–Sat on the live database (Sunday off), against the 7-day seed (A-02): asked the owner (O-09). Tests 340 (126 shared, 214 backend).

- 2026-10-04 21:00: T-1210 done. Owner round 3: every list that floated now sits in a frame (`components/list-box.tsx`: header band, rows with dividers, footer; `PrepStationCard` shared by dashboard and board; billing orders as a table with column headings; order items with a total bar; dispatch/driver order rows show boxes). Menu preview rebuilt: employee strip with counts, sticky category links, compact dish cards with an allergen band, choices behind a toggle as tables (radio/checkbox mark, one price column per size with the real added price). README: ADR numbers and docs/vault mentions removed, §13 rewritten (owner's call). `.gitignore` tidied (`prep/`). BUG-019…022 fixed. Verified in the browser as admin, kitchen, dispatch and driver; gate clean (340 tests, build).

## Outcome

Built: brand theme, dark mode and motion; rebuilt dashboards, boards and forms; the last two Shoulds (holiday warning, CSV import); perf and concurrency scripts with numbers; ADR-030 made the boards 2–3× faster. Left for the owner: live smoke test, private-window check, tag `v1.0.0`, Google Form.
