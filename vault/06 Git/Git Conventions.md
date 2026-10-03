---
type: reference
updated: 2026-10-03 18:55 IST
---

# 🌿 Git Conventions

Reviewers **read the commit history**. It should tell the story of the build: small, coherent steps with messages that explain *why*.

## Commit messages: Conventional Commits

```text
<type>(<scope>): <imperative subject, ≤ 72 chars>

<body: why this change, notable decisions, trade-offs (wrap at 72)>

Refs: T-305, BR-PRC-03
```

| Type | Use for |
|---|---|
| `feat` | User-visible capability |
| `fix` | Bug fix (reference `BUG-###`) |
| `test` | Tests only |
| `refactor` | Behaviour-preserving change |
| `perf` | Performance |
| `docs` | `docs/`, README, vault-only changes |
| `build` / `ci` / `chore` | Tooling, CI, deps, housekeeping |

Scopes: `frontend`, `backend`, `shared`, `db`, `seed`, `docs`, `vault`, `ci`, `deps`.

Examples:

- `feat(backend): enforce cut-off lock on order mutations`
- `feat(shared): resolve derived tier prices with 5-cent ceiling`
- `test(shared): cover BR-CUT-01 holiday skipping across time zones`
- `fix(frontend): keep order filters in the URL on refresh` (`Refs: BUG-004`)

## Rules

- **One coherent change per commit.** Include the vault updates that belong to that change (task board, status, matrix) in the **same** commit.
- **No WIP or "fix typo" spam** on `main`. Finish the unit, then commit.
- **Fewer, larger commits until submission** (owner, 2026-10-03 18:33, Q-14): one commit per finished feature with its vault updates; vault-only catch-ups in one `docs(vault)` commit. Every push redeploys the live app.
- **Never commit:** `.env*` (except `.env.example`), `backend/src/generated/`, `node_modules`, build outputs, `vault/.obsidian/`, `vault/_assets/*.pdf`.
- **Trunk-based on `main`.** Short-lived branches are optional. **No force-push to `main`**; never rewrite published history.
- Prefer new commits over amending.
- Agents commit **only when the owner has allowed it** in the current session.
- AI-assisted commits carry a `Co-Authored-By:` trailer for the assisting agent (AI tools are allowed by the brief; being transparent about them costs nothing).
- Tag the submission: `v1.0.0` (T-1102).

## Expected history shape (rough)

1. `docs: add planning baseline (PRD, TRD, data model, architecture, vault)`
2. `build: scaffold pnpm workspace with frontend, backend and shared packages`
3. `feat(backend): add health endpoints, config validation and error envelope`
4. `feat(db): add Prisma 7 schema v1 with check constraints`
5. `ci: lint, typecheck, test (TZ matrix) and build on push`
6. `feat(backend): cookie sessions and CASL abilities from permission codes`
7. … one or more commits per task, through P11
8. `docs: write README (architecture, decisions, dashboards, prioritisation)`
