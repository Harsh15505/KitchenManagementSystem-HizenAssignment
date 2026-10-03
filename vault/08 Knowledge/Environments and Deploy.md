---
type: reference
updated: 2026-10-03 18:47 IST
---

# 🌐 Environments and Deploy

> **No secrets in this file.** Record names and locations of secrets, never their values.

## URLs

| What | URL | Notes |
|---|---|---|
| GitHub repo (public) | https://github.com/Harsh15505/KitchenManagementSystem-HizenAssignment | branch `main` |
| Web (Vercel, owner's account) | https://kitchen-management-hizen.vercel.app | project root `frontend`; renamed 2026-10-03 18:30 from `ktichen-…` (typo). Old domain → 403 on writes |
| API (Render) | https://fernleaf-api-l0yq.onrender.com | free web service, Singapore, health `/api/health`, readiness `/api/health/ready` |
| Neon project | `withered-breeze-63566218`, branch **`dev`** (`br-quiet-boat-azse3ol5`, child of the empty default `production` branch), endpoint `ep-autumn-forest-azgcpotr.c-3.ap-southeast-1.aws.neon.tech` (db `neondb`) | Singapore. **One branch for local dev and production** (ADR-029; read from `current_setting('neon.branch_id')` 2026-10-03 18:45). Migrations `init` + `check_constraints`. Bulk scripts → a throwaway branch (`backend/.env.perf`) |
| UptimeRobot monitor | owner's account | 5-min HTTP check on API `/api/health` (on since 2026-10-03 13:58) |

## Accounts (owner)

All services run on the owner's accounts. A Vercel connector for another team ("zythos' projects") is visible to the agent and must not be used (Q-09).


GitHub · Vercel · Render · Neon · UptimeRobot. All free tiers. **Keep only one free web service in the Render workspace** (750 instance-hours/month are shared).

## Environment variables

| Var | App | Where set | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | Render, local `.env` | Neon **direct** endpoint; the same branch in both places (ADR-029) |
| `DIRECT_DATABASE_URL` | backend | Render, local `.env` | used by `prisma.config.ts` (migrate/seed) |
| `JWT_SECRET` | backend | Render, local `.env` | 64 random bytes, different per env |
| `SESSION_TTL_HOURS` | backend | Render | 12 |
| `WEB_ORIGIN` | backend | Render | `https://kitchen-management-hizen.vercel.app` (single origin; verified 18:35) |
| `CRON_SECRET` | backend | Render | optional external tick |
| `TZ` | backend | Render | `UTC` (on purpose) |
| `NODE_VERSION` | backend | Render | 22 |
| `API_ORIGIN` | frontend | Vercel (**before build**) | Render URL, used by rewrites |
| `TEST_DATABASE_URL` | CI | — | not used: CI has no database (ADR-029) |
| `DATABASE_URL` in `backend/.env.perf` | scripts | local only (git-ignored) | throwaway Neon branch for T-605/T-1206 (owner creates it) |

## Deploy procedure (TRD §13.2)

1. Neon: create the project and branches; set compute 0.25 CU fixed; copy the connection strings.
2. Render: **New → Blueprint** → this repo (reads `render.yaml`). Then enter DATABASE_URL / DIRECT_DATABASE_URL (Neon, `sslmode=verify-full`) and WEB_ORIGIN in the dashboard. Equivalent manual settings: build: `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @fernleaf/backend... build && pnpm --filter @fernleaf/backend exec prisma migrate deploy`; start: `pnpm --filter @fernleaf/backend start:prod`; health check path `/api/health`; region Singapore.
3. Vercel: import the repo; root `frontend`; build `cd .. && pnpm --filter @fernleaf/frontend... build`; set `API_ORIGIN`.
4. Seed production once: `DIRECT_DATABASE_URL=<main> pnpm --filter @fernleaf/backend db:seed`.
5. UptimeRobot monitor → API `/api/health` every 5 min.
6. Smoke test ([[Submission Checklist]]).

## Free-tier budget log (check during the review window)

| Date | Neon CU-h used (of 100) | Render hours used (of 750) | Action |
|---|---|---|---|
| 2026-10-03 | not yet checked | not yet checked | check on days 3 and 7 after submission (T-1104) |
