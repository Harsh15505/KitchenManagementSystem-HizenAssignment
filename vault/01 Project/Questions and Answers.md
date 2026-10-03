---
type: log
updated: 2026-10-03 18:47 IST
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
| Q-08 | 2026-10-03 02:09 | May the agent commit and push? | **"yes you can push directly but keep the commits clean"** | [[Git Conventions]] |
| Q-09 | 2026-10-03 12:43 | Which Vercel account? | **The owner's own account.** A Vercel connector linked to another team ("zythos' projects") exists in the agent's tools and must **not** be used | [[Environments and Deploy]] |
| Q-10 | 2026-10-03 15:44 | UI direction for the redesign; dark mode? | **"Warm kitchen brand"** and **yes, a dark mode toggle** | ADR-028 |
| Q-11 | 2026-10-03 17:04 | Scope of the redesign | "the dashboards and everything else also needs some clean rebuilds and animations too" | ADR-028 follow-up, P12 |
| Q-12 | 2026-10-03 17:58 | Theme switch feel | "should be smoother", not sudden → circular reveal | T-1204 |
| Q-13 | 2026-10-03 18:33 | Plan for the remaining time | **Approved** (quality gate, vault, holiday warning, form polish; perf/concurrency Sunday). Domain typo already fixed by the owner: https://kitchen-management-hizen.vercel.app | [[P12 Polish and Proof]] |
| Q-14 | 2026-10-03 18:33 | Working style for the rest | **Update the whole vault first, then continue; reduce the number of commits** | [[Git Conventions]] |

## Open (waiting on owner)

| # | Question | Needed by |
|---|---|---|
| ~~O-01~~ | ~~git init + first commit~~ — done by owner (bf84a7f) | — |
| ~~O-02~~ | ~~Repo name~~ — https://github.com/Harsh15505/KitchenManagementSystem-HizenAssignment | — |
| ~~O-03~~ | ~~Accounts ready~~ — done; deployed 2026-10-03 12:55 | — |
| O-04 | Is Render's `DATABASE_URL` host `ep-autumn-forest-azgcpotr…` (same branch as local, ADR-029)? | T-605 |
| ~~O-05~~ | ~~Throwaway `perf` branch~~ — done 2026-10-03 (auto-deletes after 1 day). Was: create a throwaway Neon branch (e.g. `perf`) **from `dev`** (the one with the data); paste its connection string into `backend/.env.perf` yourself (not in chat) | T-605, T-1206 (Sun morning) |
| ~~O-07~~ | ~~Remove the expiry on `dev`~~ — done by the owner 2026-10-03 | — |
| O-08 | Optional: set the `dev` compute's max autoscale to 0.25 CU (it shows 0.25 ↔ 2) so the free 100 CU-h/month lasts the 2-week review | before submission |
| ~~O-06~~ | ~~Rotate the Neon password~~ — owner: not needed. Was: rotate the Neon password (it was pasted in chat); update Render and `backend/.env` | before submission |
