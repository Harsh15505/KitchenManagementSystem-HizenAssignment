---
type: log
updated: 2026-10-03 01:30 IST
---

# ❓ Questions and Answers (owner decisions)

Every question asked of the owner, with the answer and when it was given. Answers here are **binding** until superseded. Supersede by adding a new row; don't edit history.

| # | When (IST) | Question | Answer | Recorded as |
|---|---|---|---|---|
| Q-01 | 2026-10-03 00:45 | Where should the live app run? | **Vercel (web) + Render free (API, Singapore) + Neon free (Postgres, Singapore)**, kept awake by an uptime pinger | ADR-002 |
| Q-02 | 2026-10-03 00:45 | Existing starter repo or fresh start? | **Fresh pnpm + Turborepo monorepo** in `D:\HizenAssesment` (apps/web, apps/api, packages/shared), one public repo | ADR-001 |
| Q-03 | 2026-10-03 00:45 | UI component library? | **shadcn/ui + Tailwind** (+ TanStack Table, React Hook Form + Zod) | ADR-019 |
| Q-04 | 2026-10-03 00:45 | Commit the vault to the public repo? | **Yes, commit it.** Vault updates ride along with feature commits; `.obsidian/` and the assignment PDF stay git-ignored | ADR-021 |
| Q-05 | 2026-10-03 01:10 | Time zone and currency? | **IST (Asia/Kolkata)**. Currency: the owner considered rupees, then confirmed **"keep dollars and cents as in the brief"**. All money in **USD, integer cents** | ADR-006, PRD A-01 |
| Q-06 | 2026-10-03 01:51 | Repo structure? Asked after the owner said they weren't sure what "monorepo" means; options explained with pros and cons | **One repo with `frontend/`, `backend/`, `shared/` + pnpm workspaces, no Turborepo** | ADR-022 (supersedes the layout part of Q-02 / ADR-001) |
| Q-07 | 2026-10-03 01:51 | RBAC: own guards or a library like CASL (used before)? | **CASL, with abilities built from permission codes**. The recommended alternative was own guards; the owner chose familiarity | ADR-023 |

## Open (waiting on owner)

| # | Question | Needed by |
|---|---|---|
| O-01 | Go-ahead to `git init` and make the first commit (T-005) | Before P1 |
| O-02 | GitHub repo name and account (public) | T-005 / T-108 |
| O-03 | Accounts ready: Vercel, Render, Neon, UptimeRobot (free) | T-108 (CP1) |
