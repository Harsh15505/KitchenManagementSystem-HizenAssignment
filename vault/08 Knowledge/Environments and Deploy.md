---
type: reference
updated: 2026-10-03 01:45 IST
---

# 🌐 Environments and Deploy

> **No secrets in this file.** Record names and locations of secrets, never their values.

## URLs

| What | URL | Notes |
|---|---|---|
| GitHub repo (public) | https://github.com/Harsh15505/KitchenManagementSystem-HizenAssignment | branch `main` |
| Web (Vercel) | _tbd_ | project root `frontend` |
| API (Render) | _tbd_ | free web service, Singapore, health `/api/health` |
| Neon project | host `ep-autumn-forest-azgcpotr.c-3.ap-southeast-1.aws.neon.tech` (db `neondb`) | Singapore. Migrations `init` + `check_constraints` applied 2026-10-03. Local dev currently points at this endpoint (owner-provided); confirm whether it is the `main` or a `dev` branch before seeding prod |
| UptimeRobot monitor | _tbd_ | 5-min HTTP check on API `/api/health` |

## Accounts (owner)

GitHub · Vercel · Render · Neon · UptimeRobot. All free tiers. **Keep only one free web service in the Render workspace** (750 instance-hours/month are shared).

## Environment variables

| Var | App | Where set | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | Render, local `.env` | Neon **direct** endpoint (`main` in prod, `dev` locally) |
| `DIRECT_DATABASE_URL` | backend | Render, local `.env` | used by `prisma.config.ts` (migrate/seed) |
| `JWT_SECRET` | backend | Render, local `.env` | 64 random bytes, different per env |
| `SESSION_TTL_HOURS` | backend | Render | 12 |
| `WEB_ORIGIN` | backend | Render | the Vercel URL (Origin check) |
| `CRON_SECRET` | backend | Render | optional external tick |
| `TZ` | backend | Render | `UTC` (on purpose) |
| `NODE_VERSION` | backend | Render | 22 |
| `API_ORIGIN` | frontend | Vercel (**before build**) | Render URL, used by rewrites |
| `TEST_DATABASE_URL` | CI | GitHub secret | Neon `test` branch (integration tests) |

## Deploy procedure (TRD §13.2)

1. Neon: create the project and branches; set compute 0.25 CU fixed; copy the connection strings.
2. Render: new web service from the repo; build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @fernleaf/backend... build && pnpm --filter @fernleaf/backend exec prisma migrate deploy`; start: `pnpm --filter @fernleaf/backend start:prod`; health check path `/api/health`; region Singapore.
3. Vercel: import the repo; root `frontend`; build `cd .. && pnpm --filter @fernleaf/frontend... build`; set `API_ORIGIN`.
4. Seed production once: `DIRECT_DATABASE_URL=<main> pnpm --filter @fernleaf/backend db:seed`.
5. UptimeRobot monitor → API `/api/health` every 5 min.
6. Smoke test ([[Submission Checklist]]).

## Free-tier budget log (check during the review window)

| Date | Neon CU-h used (of 100) | Render hours used (of 750) | Action |
|---|---|---|---|
| _tbd_ | | | |
