---
type: phase
id: P0
status: done
estimate: 1.5h
window: Sat 3 Oct 00:25–02:00 IST
---

# P0: Planning and project brain

**Goal:** understand the brief completely, settle the decisions that are the owner's to make, write the spec docs, and create a vault that lets any agent continue the work.

## Tasks

- [x] **T-001** Analyse the brief + emails; extract requirements (FR/BR/NFR/A IDs) → `docs/PRD.md`
- [x] **T-002** Confirm with owner: hosting, repo shape, UI kit, vault in git, TZ/currency → [[Questions and Answers]]
- [x] **T-003** Write `docs/PRD.md`, `docs/TRD.md`, `docs/DATABASE_MODELS.md`, `docs/ARCHITECTURE.md`
- [x] **T-004** Create the vault (status, protocol, phases, tasks, decisions, knowledge, templates) + `AGENTS.md`/`CLAUDE.md` + `.gitignore`/`.gitattributes`
- [x] **T-005** `git init`, first commit `docs: add planning baseline (PRD, TRD, data model, architecture, vault)`; create the public GitHub repo, push. **Waiting for the owner's go-ahead.**
- [x] **T-006** Revisit the repo layout and RBAC with the owner: `frontend/` + `backend/` + `shared/` with pnpm workspaces, no Turborepo (ADR-022); CASL abilities built from permission codes (ADR-023). Docs and vault updated

## Exit criteria

- [x] Every [Must] in the brief maps to an FR ID and a phase ([[Requirements Matrix]])
- [x] Every ambiguity has a written interpretation (PRD §10, A-01…A-40)
- [x] The data model is designed, with invariants and enforcement points (DATABASE_MODELS §6)
- [x] Vault protocol written; STATUS current
- [ ] First commit made (T-005)

## Log

- 2026-10-03 00:25: Brief read in full. Key risks found: the rolling "today", free-tier sleep/compute, cross-site cookies.
- 2026-10-03 00:45: Owner chose Vercel + Render + Neon, a fresh monorepo, shadcn/ui, and committing the vault.
- 2026-10-03 00:55: Research: Prisma 7 setup changes; Next 16 `proxy.ts`; Render free 750 h / 15-min spin-down; Neon free 100 CU-h, so the jobs design must be DB-frugal.
- 2026-10-03 01:01: Noticed the deadline falls on a weekend → seed a 7-day kitchen (A-02).
- 2026-10-03 01:10: Owner briefly considered INR, then confirmed **USD, cents as in the brief**. Docs reverted to cents.
- 2026-10-03 01:45: Docs and vault complete. Waiting for go-ahead on T-005.
- 2026-10-03 01:51: The owner asked what "monorepo" means and whether to use CASL. Explained the repo options (two repos / independent folders / workspaces / + task runner) and guards vs CASL. The owner chose `frontend/` + `backend/` + `shared/` (pnpm, no Turborepo) and CASL from permission codes. Docs and vault updated (ADR-022, ADR-023).

## Outcome

Done. Planning baseline committed and pushed by the owner as `bf84a7f` to https://github.com/Harsh15505/KitchenManagementSystem-HizenAssignment. Next: P1.
