---
type: status
updated: 2026-10-03 01:51 IST
phase: P0 → P1
active_task: T-005
---

# 📍 STATUS: live snapshot

> **Update this note at the end of every task and every session.** It's the first thing the next agent reads.

## TL;DR

Planning is complete. The spec docs (`docs/PRD.md`, `docs/TRD.md`, `docs/DATABASE_MODELS.md`, `docs/ARCHITECTURE.md`) and this vault exist. **No code yet, and the repo isn't initialised with git yet.** Next: initialise git and make the first commit (needs the owner's go-ahead), then start **P1 Foundation**.

## ⏳ Deadline

**Sun 4 Oct 2026, 23:59 IST.** About 46.5 h left as of 01:30 IST Sat 3 Oct. Checkpoints: [[Timeline and Checkpoints]].

## Current phase

- **P0 Planning**: ✅ done (except T-005) → [[P0 Planning]]
- **Next phase: P1 Foundation** → [[P1 Foundation]]

## 🔨 Active task

- **T-005** `git init` + first commit "docs: planning baseline (PRD, TRD, data model, architecture, vault)". ⏳ **Waiting for the owner's go-ahead** (agents commit only when asked).

## ✅ Done so far

- T-001 Brief analysed; requirements extracted (FR/BR/NFR IDs in PRD)
- T-002 Decisions confirmed with owner (see [[Questions and Answers]])
- T-003 Spec docs written
- T-004 Vault, agent protocol, AGENTS.md / CLAUDE.md created
- T-006 Repo layout and RBAC revisited with the owner: `frontend/` + `backend/` + `shared/` (ADR-022); CASL abilities from permission codes (ADR-023)

## ⏭ Next up (in order)

1. T-005 git init + first commit (after owner OK). Create the public GitHub repo (name to be chosen by owner)
2. T-101 Workspace scaffold (pnpm workspaces: `frontend/`, `backend/`, `shared/`)
3. T-102 `shared` skeleton (tsup, vitest, zod)
4. T-103 `backend` NestJS scaffold (health, config, error envelope)
5. T-104 Prisma 7 + Neon dev branch + schema draft v1 validation
6. T-105 `frontend` Next.js 16 + shadcn + rewrites + proxy.ts
7. T-108 Provision Neon/Render/Vercel and deploy the skeleton **early**

## ⛔ Blockers / waiting on owner

- Go-ahead for git init and the first commit (T-005)
- Owner needs accounts ready: **GitHub**, **Vercel**, **Render**, **Neon**, **UptimeRobot** (free tiers). The GitHub connector in the agent environment failed to connect; use the `git` / `gh` CLI or create the repo in the browser.

## 🌐 Environments

| Env | URL | Status |
|---|---|---|
| Web (Vercel) | _tbd_ | not provisioned |
| API (Render) | _tbd_ | not provisioned |
| DB (Neon) | _tbd_ (project `fernleaf-kitchen-ops`, Singapore) | not provisioned |
| Repo (GitHub) | _tbd_ | not created |

## 🧾 Key decisions so far

ADR-001…ADR-023 in [[Decision Log]]. Most important: one repo with `frontend/` + `backend/` + `shared/` (ADR-022), Vercel + Render + Neon, cookie JWT through a same-origin proxy, roles as permission codes → CASL abilities (ADR-023), integer cents (USD), IST kitchen time zone, immutable invoices + adjustments, rolling demo data with a 7-day kitchen.

## 🧷 Last commit

_None yet (repo not initialised)._

## 🤝 Handoff notes for the next agent

- Read [[AGENT PROTOCOL]] before doing anything; keep this brain updated after every task.
- Don't start the **Should** items until every **Must** works end to end (see [[Phase Plan]] cut lines).
- Deploy the skeleton early (T-108). Free-tier gotchas: [[Gotchas]].
- Every business rule has an ID in `docs/PRD.md` §5. Name tests after those IDs.
