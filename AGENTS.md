# AGENTS.md: start here (any AI agent or new contributor)

**Project:** Fernleaf Kitchen Ops, the internal admin panel for a corporate boxed-meal kitchen (Heizen engineering assignment).
**Deadline:** Sun 4 Oct 2026, 23:59 IST. **Stack (mandatory):** Next.js (web) · NestJS (API) · Prisma (ORM) · Postgres (Neon).

## 1. Before you do anything

The project's memory lives in **`vault/`** (an Obsidian vault). Read, in this order:

1. `vault/STATUS.md`: current phase, active task, next steps, blockers
2. `vault/AGENT PROTOCOL.md`: **mandatory** rules for keeping the vault updated
3. The active phase note in `vault/02 Phases/` and `vault/03 Tasks/Task Board.md`
4. Specs as needed: `docs/PRD.md` (requirements FR-*, rules BR-*, dashboards, assumptions A-*), `docs/TRD.md` (stack, API, algorithms, deploy), `docs/DATABASE_MODELS.md` (ERD, Prisma schema, constraints), `docs/ARCHITECTURE.md` (diagrams, ADR summary)
5. `vault/08 Knowledge/Gotchas.md` before touching Prisma, dates, cookies or deployment

Vault file names contain spaces, so quote paths in shell commands.

## 2. Non-negotiables

- The frontend talks to the backend **over HTTP only**. No business logic in Next.js server actions, and no DB access from `frontend`.
- **Permissions are enforced on the server.** Roles hold permission codes, and CASL abilities are built from those codes in `shared/src/authz/`. Never compare role names (`'admin'`, `'driver'`) in code.
- **Every business rule is validated on the server**, as a pure function in `shared/src/domain/` plus transactional enforcement in the API.
- **Money:** integer **cents (USD)** in fields named `*Cents`. No floats. Derived prices round **up to the next 5¢**.
- **Time:** kitchen time zone **Asia/Kolkata (IST)**. Kitchen-local dates are `YYYY-MM-DD` (`@db.Date`); instants are UTC. Never use the server's or browser's local time for business logic.
- **Tests** for business rules are named after their rule IDs (`BR-CUT-01 …`). Bug fixes get `BUG-### …` regression tests.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` must stay clean.
- Deviating from `docs/` requires an ADR in `vault/05 Decisions/Decision Log.md` **and** updating the doc in the same change.

## 3. Keep the brain updated (summary of the protocol)

After **every task**: Task Board → phase note → Requirements Matrix → STATUS (+ Decision Log / Bug Tracker / Prioritisation Notes when relevant).
After **every commit**: Commit Log. At **session end**: a session note in `vault/07 Sessions/` with an exact handoff, and STATUS updated.

## 4. Git

Conventional Commits (`feat(backend): …`, `fix(frontend): …`, `docs(vault): …`) with `Refs: T-xxx`. Commit **only when the owner allows it**. Never commit `.env*`, the generated Prisma client, `vault/.obsidian/` or `vault/_assets/*.pdf`. Details: `vault/06 Git/Git Conventions.md`.

## 5. Layout

```text
docs/              specs (PRD, TRD, DATABASE_MODELS, ARCHITECTURE)
vault/             project brain (status, phases, tasks, bugs, decisions, sessions, commits, knowledge)
frontend/          Next.js 16 UI                        (created in P1)
backend/           NestJS 11 API + Prisma 7 + CASL      (created in P1)
shared/            contracts, permission codes + CASL rules, pure domain rules (created in P1)
```

Commands: `vault/08 Knowledge/Runbook.md`.
