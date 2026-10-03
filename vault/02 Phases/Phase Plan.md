---
type: plan
updated: 2026-10-03 18:55 IST
---

# 🗺 Phase Plan

The build is split into phases that each end in a **working, deployable increment**. Each phase note holds its tasks (with acceptance criteria), exit criteria and a log. Status and checkpoints: [[STATUS]], [[Timeline and Checkpoints]].

| Phase                          | Goal                                                                                     | Est.       | Target done (IST) | Depends on  | Status                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | ----------------- | ----------- | ------------------------------------------ |
| [[P0 Planning]]                | Specs, vault, decisions, first commit                                                    | 1.5 h      | Sat 02:00         | —           | ✅                                          |
| [[P1 Foundation]]              | Workspace (`frontend/`, `backend/`, `shared/`), Prisma + Neon, CI, **skeleton deployed** | 4 h        | Sat 13:00 (CP1)   | P0          | ✅ Sat 13:58 (code 03:10; deploy waited on accounts) |
| [[P2 Auth and Access]]         | Login, CASL RBAC from permission codes, staff, settings, reference data, clock           | 3 h        | Sat 13:00 (CP1)   | P1          | ✅ Sat 06:15 (live 13:58) |
| [[P3 Catalogue Pricing Menu]]  | Dishes/options/groups, tiers + derivation + grid, menu + preview                         | 6 h        | Sat 21:00 (CP2)   | P2          | ✅ Sat 07:12 |
| [[P4 Companies and Employees]] | Companies (domains, addresses, calendar, defaults, visibility), employees                | 3 h        | Sat 21:00 (CP2)   | P3          | ✅ Sat 07:06 (Musts; T-406 skipped, T-409 in P12) |
| [[P5 Orders and Cutoff]]       | Order builder, validation, statuses, cut-off processing, list/detail, demo v1            | 6.5 h      | Sun 10:00 (CP3)   | P4          | ✅ Sat 10:54 |
| [[P6 Kitchen Board]]           | Prep units, start/done, plans, late/at-risk, force-complete, perf                        | 3 h        | Sun 16:30 (CP4)   | P5          | ✅ Sat 11:05 (T-605 perf in P12) |
| [[P7 Dispatch and Driver]]     | Drops, dispatch board, driver phone view, photo, on-time                                 | 3.5 h      | Sun 16:30 (CP4)   | P6          | ✅ Sat 11:20 |
| [[P8 Billing]]                 | Uninvoiced → invoice → paid; adjustments policy                                          | 2.5 h      | Sun 16:30 (CP4)   | P5          | ✅ Sat 11:45 |
| [[P9 Dashboards]]              | 4 role dashboards with defined figures                                                   | 3 h        | Sun 20:30 (CP5)   | P6 P7 P8    | ✅ Sat 12:05 |
| [[P10 Demo Data and Deploy]]   | Full seed, rolling window, autopilot, prod verification                                  | 3 h        | Sun 20:30 (CP5)   | P5 (+P6–P8) | ✅ Sat 13:58 (T-1006 smoke pending) |
| [[P11 README and Submission]]  | README, quality gate, form submission, keep-alive                                        | 2 h        | Sun 22:30 (CP6)   | all         | 🟨 README done; tag + form Sun |
| [[P12 Polish and Proof]] | UI polish, perf + concurrency proof, cheap Shoulds | 8 h | Sun 20:00 (freeze) | P11 | 🟨 T-1201…T-1204 done |
| **Total**                      |                                                                                          | **≈ 40 h** |                   |             |                                            |

## Ordering rationale

1. **Deploy the skeleton first (P1).** Free-tier and monorepo deployment surprises are the biggest unknown, and the brief requires a live link.
2. **Access before features (P2).** Every later endpoint needs the permission guard. Building it first means no retrofitting.
3. **Catalogue → pricing → menu → companies → orders.** This follows the data dependencies; orders need all of them.
4. **Demo generator v1 at the end of P5**, so the kitchen, dispatch, billing and dashboard work happens on realistic data.
5. **Billing (P8) depends only on P5**, so it can run in parallel with P6/P7 if a second agent is available.
6. **Dashboards late (P9)**, because they read everything. Their definitions are already fixed in PRD §8.
7. **README notes are written continuously** ([[Prioritisation Notes]]), so P11 is assembly rather than authoring.

## Parallelisation (if a second agent or worktree is available)

- After P5: P6 ∥ P8 (independent modules), then P7.
- P10 static seed content (dishes and companies text) can be prepared at any time.

## Actuals

Every Must was live by Sat 13:58, about 33 h before CP6. The spare time went into P12 (polish and proof) instead of cutting scope.

## Cut lines

See [[Timeline and Checkpoints]] → A, B, C. Every cut gets a row in [[Prioritisation Notes]].
