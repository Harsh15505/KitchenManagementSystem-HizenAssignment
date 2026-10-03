---
type: home
updated: 2026-10-03 18:55 IST
---

# 🧠 Fernleaf Kitchen Ops: Project Brain

This vault is the **single place that holds the full state of the project**. Any human or AI agent should be able to open it and continue the work from exactly where it stopped, without reading chat history.

> **Docs vs. vault.** `docs/` holds the **specification** (what and how to build): PRD, TRD, DATABASE_MODELS, ARCHITECTURE. `vault/` holds the **state and history** (where we are, what's next, what broke, what we decided, what we committed). When they disagree, fix it immediately and log a decision in [[Decision Log]].

---

## ⚡ 60-second facts

| | |
|---|---|
| **What** | Heizen engineering round: build the *Kitchen Operations Admin Panel* for the fictional "Fernleaf Kitchen" (corporate boxed-meal programs) |
| **Deadline** | **Sun 4 Oct 2026, 23:59 IST**: Google Form with live link + public repo |
| **Stack (mandatory)** | Next.js (web) · NestJS (API) · Prisma (ORM) · Postgres |
| **Our choices** | One repo: `frontend/` + `backend/` + `shared/` (pnpm workspaces) · CASL RBAC built from permission codes · shadcn/ui + Tailwind · TanStack Query/Table · Zod everywhere · Vercel + Render + Neon (Singapore, one branch: ADR-029) · warm brand theme + dark mode (ADR-028) |
| **Time zone / money** | **Asia/Kolkata (IST)** · **USD, integer cents** (as in the brief, confirmed by owner) |
| **Live** | Web https://kitchen-management-hizen.vercel.app · API https://fernleaf-api-l0yq.onrender.com/api/health · Repo https://github.com/Harsh15505/KitchenManagementSystem-HizenAssignment |
| **Test accounts** | `admin@test.com` · `kitchen@test.com` · `dispatch@test.com` · `driver@test.com`, password `Test@1234` |
| **Current state** | See [[STATUS]] |

---

## 🧭 Reading order for a new agent or session

1. [[STATUS]]: where we are right now, the active task and the next steps (**always first**)
2. [[AGENT PROTOCOL]]: the rules for keeping this brain up to date (**mandatory**)
3. [[Project Brief]]: the assignment in brief, deliverables and evaluation
4. The active phase note in `02 Phases/` (linked from STATUS)
5. [[Task Board]]: every task and its status
6. Specs as needed (outside the vault, read them with file tools):
   - `docs/PRD.md`: requirements (FR-*), business rules (BR-*), dashboards, assumptions (A-*)
   - `docs/TRD.md`: stack, API, algorithms, testing, deployment
   - `docs/DATABASE_MODELS.md`: ERD, Prisma schema, constraints
   - `docs/ARCHITECTURE.md`: diagrams, flows, ADR summary
7. [[Gotchas]] before touching Prisma, dates, cookies or deployment

---

## 🗂 Map

| Folder | What lives there |
|---|---|
| `01 Project/` | [[Project Brief]] · [[Requirements Matrix]] · [[Timeline and Checkpoints]] · [[Glossary]] · [[Questions and Answers]] |
| `02 Phases/` | [[Phase Plan]] and one note per phase (P0 to P12) with tasks, exit criteria and a log |
| `03 Tasks/` | [[Task Board]] (Kanban: Backlog → Next Up → In Progress → Blocked → Review → Done) |
| `04 Bugs/` | [[Bug Tracker]] (index) and one note per non-trivial bug |
| `05 Decisions/` | [[Decision Log]] (ADR-001…, chronological, never deleted, only superseded) |
| `06 Git/` | [[Commit Log]] · [[Git Conventions]] |
| `07 Sessions/` | One log per working session (goal → done → decisions → handoff) |
| `08 Knowledge/` | [[Tech Stack]] · [[Environments and Deploy]] · [[Runbook]] · [[Gotchas]] · [[Demo Data Plan]] |
| `09 Submission/` | [[Submission Checklist]] · [[README Outline]] · [[Prioritisation Notes]] |
| `_templates/` | Templates for tasks, bugs, decisions, sessions, phases |
| `_assets/` | Original assignment PDF (**git-ignored**, local only) |

---

## 🛠 Obsidian setup (one-time)

- Open **`vault/`** as the vault. `docs/` sits outside it, so links to specs are written as paths.
  - *Alternative:* open the repo root as the vault and exclude `node_modules`, `.next` and `dist` under Settings → Files & links → Excluded files. Then `docs/` is navigable too.
- Settings → Core plugins → **Templates** → template folder: `_templates`.
- Optional community plugins:
  - **Kanban**: renders [[Task Board]] as a board. Without it, the board is still readable as a plain list.
  - **Dataview**: the notes carry YAML frontmatter (`type`, `status`, `phase`), so you can build dashboards.
- `vault/.obsidian/` is git-ignored (personal settings stay local).
