---
type: reference
updated: 2026-10-03 01:45 IST
---

# 📒 Runbook

> **Verified so far:** `pnpm install`, `pnpm build/lint/typecheck/test/format:check`, `db:migrate`, `db:seed` (2026-10-03).
>
> **Status: planned commands.** Confirm and correct them during P1 (T-101…T-105). Remove the "planned" marker when verified.

## Local setup (planned)

```bash
corepack enable
pnpm install
cp backend/.env.example backend/.env      # fill DATABASE_URL (Neon dev branch), JWT_SECRET
cp frontend/.env.example frontend/.env      # API_ORIGIN=http://localhost:4000
pnpm --filter @fernleaf/backend exec prisma migrate dev
pnpm --filter @fernleaf/backend db:seed
pnpm dev                                     # frontend :3000, backend :4000
```

## Everyday commands (planned)

| Command | What |
|---|---|
| `pnpm dev` | Run frontend + backend + shared (watch) |
| `pnpm build` | Build everything (`pnpm -r`, shared first) |
| `pnpm lint` / `pnpm typecheck` | Must be clean before every commit |
| `pnpm test` | All unit tests |
| `pnpm --filter @fernleaf/shared test` | Domain rule tests only |
| `TZ=America/Los_Angeles pnpm --filter @fernleaf/shared test` | Prove TZ independence |
| `pnpm --filter @fernleaf/backend test:int` | Integration tests (needs `TEST_DATABASE_URL`) |
| `pnpm --filter @fernleaf/backend exec prisma migrate dev --name <name>` | New migration (dev branch) |
| `pnpm --filter @fernleaf/backend exec prisma migrate dev --create-only` | Hand-edit SQL (CHECK constraints) |
| `pnpm --filter @fernleaf/backend db:migrate` | `prisma migrate dev` (create + apply) |
| `pnpm --filter @fernleaf/backend db:deploy` | `prisma migrate deploy` (production, Render build) |
| `pnpm --filter @fernleaf/backend db:seed` | Idempotent static seed |
| `pnpm --filter @fernleaf/backend exec prisma studio` | Inspect the DB |
| `pnpm perf:kitchen` | 400-order kitchen board perf script (T-605) |
| `pnpm vault:commits` | Regenerate [[Commit Log]] from git (T-110) |

## Operations

| Situation | Do |
|---|---|
| Cut-off didn't process | Cut-off page → "Run now" for the date (idempotent), or `POST /api/cutoff/run` |
| Demo data looks stale | Settings → Demo data → Regenerate (only `DEMO` orders are reset) |
| API asleep / slow first request | Check UptimeRobot; Render cold start ≈ 1 min |
| Neon budget > 80 % | Settings → switch demo autopilot off; reduce board polling |
| Bad deploy | Vercel: instant rollback. Render: redeploy the previous commit. Migrations are additive |
