---
type: protocol
updated: 2026-10-03 01:30 IST
---

# 🤖 Agent Protocol: how to work in this repo (mandatory)

These rules apply to **every** agent (Claude, Codex, Cursor, …) and to the human owner. The point: **the vault must always contain everything needed to pick up the project from where it was left.** If something is only in a chat transcript, it's lost.

---

## 1. Session start (always)

1. Read [[STATUS]] → [[AGENT PROTOCOL]] (this note) → the active phase note → [[Task Board]].
2. Skim the latest note in `07 Sessions/` (the previous handoff).
3. Create a new session note from `_templates/Session Template.md` → `07 Sessions/YYYY-MM-DD Sxx - <topic>.md` (S-number = previous + 1).
4. If the owner gave new instructions, record them in the session note and, if they change scope or rules, in [[Decision Log]].

## 2. Before starting a task

- Pick the top item of **Next Up** on the [[Task Board]] (or what the owner asks for).
- Move its card to **In Progress** and set `active_task` and the "Active task" section in [[STATUS]].
- Re-read the PRD/TRD sections the task cites (FR-, BR-, A- IDs).

## 3. While working

- Follow the specs in `docs/`. **If you must deviate**, stop, write an ADR in [[Decision Log]], update the affected doc(s) in `docs/` in the same change, and mention it in the session note.
- Any bug you find, even one you fix immediately, goes into [[Bug Tracker]] with an ID (`BUG-###`). Fixing it means adding a regression test named `BUG-### …`.
- Ambiguity → decide sensibly, record it as an assumption (PRD §10, `A-##`) plus a line in [[Prioritisation Notes]] or [[Decision Log]]. Ask the owner only when the decision is genuinely theirs.
- New gotcha discovered → add it to [[Gotchas]].

## 4. Definition of Done (per task)

A task is **Done** only when all of these hold:

- [ ] Code implements the cited FR/BR IDs, with server-side validation and permissions
- [ ] Tests exist for the business rules touched (named with BR IDs) and pass
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass (once P1 sets them up)
- [ ] The UI shows actionable errors (no silent failures)
- [ ] The vault is updated (see §5)
- [ ] Committed with a Conventional Commit message referencing the task ID (only when the owner has allowed committing)

## 5. After each task: update the brain (the checklist)

| Update | Where |
|---|---|
| Move the card to **Done** (or Review/Blocked) | [[Task Board]] |
| Tick the task checkbox and add a dated log line | the phase note `02 Phases/Px …` |
| Set requirement status (⬜ → 🟨 → ✅ / ⏭️) and implementation paths and tests | [[Requirements Matrix]] |
| Active task, next up, last commit, handoff | [[STATUS]] |
| New decision or deviation | [[Decision Log]] (+ docs) |
| Bugs found/fixed | [[Bug Tracker]] |
| Skipped/cut scope, interpretations | [[Prioritisation Notes]] (feeds the README) |
| New/changed commands, env vars, URLs | [[Runbook]] / [[Environments and Deploy]] |

## 6. After each commit

- Add a row to [[Commit Log]]: date/time (IST), short hash, message, task IDs, phase.
  - The hash only exists after committing, so either add the row in the next commit, or run `pnpm vault:commits` (T-110) once it exists. That script regenerates the table from `git log`.
- Commits follow [[Git Conventions]]. **Never** commit secrets (`.env*`), generated Prisma clients or the assignment PDF.

## 7. Phase completion

- All exit criteria in the phase note are ticked, and the "Outcome" section is written (what was built, what was cut and why, follow-ups).
- [[Phase Plan]] table: the phase is marked ✅ with its actual finish time.
- [[Timeline and Checkpoints]]: compare against the checkpoint and **re-plan** (apply cut lines if behind).
- [[STATUS]] moves to the next phase.

## 8. Session end (always, even if interrupted early)

- Fill in the session note: what was done (task IDs), decisions, bugs, commits, **handoff: exact next step**.
- Update [[STATUS]] (TL;DR, active task, next up, blockers, last commit, handoff).
- Leave the working tree either committed or clearly described in STATUS ("uncommitted changes in …: reason").

## 9. ID conventions

| Prefix | Meaning | Defined in |
|---|---|---|
| `FR-<AREA>-nn` | Functional requirement | `docs/PRD.md` §4 |
| `BR-<AREA>-nn` | Business rule (test names use these) | `docs/PRD.md` §5 |
| `NFR-nn` | Non-functional requirement | `docs/PRD.md` §9 |
| `A-nn` | Assumption / interpretation | `docs/PRD.md` §10 |
| `ADR-nnn` | Architecture/product decision | [[Decision Log]] |
| `T-pnn` | Task (p = phase number, e.g. T-305) | [[Task Board]] + phase notes |
| `BUG-nnn` | Bug | [[Bug Tracker]] |
| `Sxx` | Session number | `07 Sessions/` |

## 10. Style

- Times in **IST** (`YYYY-MM-DD HH:mm IST`). Use the kitchen time zone in all examples.
- Obsidian **wikilinks** inside the vault (`[[Task Board]]`). Plain paths for files outside it (`docs/TRD.md`).
- Never delete history (tasks, bugs, decisions). Mark them *superseded* or *won't do* with a reason.
- Keep notes short and factual. Tables over prose. Link instead of duplicating.
