---
type: reference
updated: 2026-10-03 18:55 IST
---

# 📒 Runbook

> **Verified 2026-10-03 18:55** against the `scripts` in each `package.json`. Commands marked *(planned)* don't exist yet.

## Local setup

```bash
corepack enable
pnpm install                                 # backend postinstall runs prisma generate
cp backend/.env.example backend/.env         # DATABASE_URL, DIRECT_DATABASE_URL (Neon), JWT_SECRET
cp frontend/.env.example frontend/.env       # API_ORIGIN=http://localhost:4000
pnpm --filter @fernleaf/backend db:deploy    # apply migrations (incl. CHECK constraints)
pnpm --filter @fernleaf/backend db:seed      # idempotent
pnpm dev                                     # builds shared, then frontend :3000 + backend :4000 + shared watch
```

> ⚠️ Local `.env` points at the **production** Neon branch (ADR-029). Anything you click locally shows on the live app.

If port 3000 is taken (the owner runs another project there), use the Claude preview configs in `.claude/launch.json`: `backend-3001` (`WEB_ORIGIN=http://localhost:3001`, port 4000) + `frontend-3001` (`next dev --port 3001`).

## Everyday commands

| Command | What |
|---|---|
| `pnpm dev` | Build shared once, then run all three packages in watch mode |
| `pnpm build` | Build everything (`pnpm -r`, shared first). **Not while `pnpm dev` runs** (wipes `backend/dist`) |
| `pnpm --filter @fernleaf/frontend build` | Frontend only; builds shared first only if `shared/dist` is missing (`scripts/ensure-shared.mjs`) |
| `pnpm lint` / `pnpm typecheck` | Must be clean before every commit |
| `pnpm format` / `pnpm format:check` | Prettier (CI runs the check) |
| `pnpm test` | All tests (shared 112 + backend 207 as of 18:40) |
| `pnpm --filter @fernleaf/shared test` | Domain rule tests only |
| `TZ=America/Los_Angeles pnpm --filter @fernleaf/shared test` | Prove TZ independence |
| `pnpm --filter @fernleaf/backend db:migrate` | `prisma migrate dev` (create + apply; careful: production branch) |
| `pnpm --filter @fernleaf/backend exec prisma migrate dev --create-only` | Hand-edit SQL (CHECK constraints) |
| `pnpm --filter @fernleaf/backend db:deploy` | `prisma migrate deploy` (also runs in the Render build) |
| `pnpm --filter @fernleaf/backend db:seed` | Idempotent static seed: roles, staff, settings, reference lists, catalogue (27 dishes, 17 options), 4 tiers, menu, 5 companies, 60 employees. Never overwrites admin edits. ~65 s against Neon |
| `pnpm --filter @fernleaf/backend db:studio` | Inspect the DB |
| `pnpm --filter @fernleaf/backend perf:kitchen` *(planned, T-605)* | 400-order kitchen board timing on the throwaway branch (`backend/.env.perf`) |
| `pnpm --filter @fernleaf/backend probe:concurrency` *(planned, T-1206)* | Race + integrity checks on the throwaway branch |

## Operations

| Situation | Do |
|---|---|
| Cut-off didn't process | Cut-off page → "Run now" for the date (idempotent), or `POST /api/cutoff/run` |
| Demo data looks stale | Settings → Demo data → Regenerate (only `DEMO` orders are reset) |
| API asleep / slow first request | Check UptimeRobot; Render cold start ≈ 1 min |
| Neon budget > 80 % | Settings → switch demo autopilot off; reduce board polling |
| Bad deploy | Vercel: instant rollback. Render: redeploy the previous commit. Migrations are additive |
| Login fails with 403 on the live app | The browser is on an old domain: `WEB_ORIGIN` accepts only https://kitchen-management-hizen.vercel.app |
| Check CI without `gh` | `https://api.github.com/repos/Harsh15505/KitchenManagementSystem-HizenAssignment/actions/runs?per_page=3` |
