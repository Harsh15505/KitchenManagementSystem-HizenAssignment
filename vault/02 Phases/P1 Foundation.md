---
type: phase
id: P1
status: in-progress
estimate: 4h
target: CP1 Sat 3 Oct 13:00 IST (with P2)
---

# P1: Foundation and walking skeleton

**Goal:** one repo with `frontend/`, `backend/` and `shared/` (pnpm workspaces) that builds, lints, type-checks and tests in CI, with Prisma connected to Neon, **deployed end to end** (Vercel → Render → Neon) and kept alive.

Specs: `docs/TRD.md` §2–4, §13 · `docs/ARCHITECTURE.md` §3–4 · [[Gotchas]]

## Tasks

- [x] **T-101** Workspace scaffold: root `package.json` (`packageManager: pnpm@10`, `engines.node: 22`, scripts `dev`/`build`/`lint`/`typecheck`/`test` via `pnpm -r`), `pnpm-workspace.yaml` listing `frontend`, `backend`, `shared`, `.nvmrc`, `.editorconfig`.
  *Accept:* `pnpm install && pnpm -r build` succeeds on an empty skeleton (shared builds first).
- [x] **T-102** `shared` (`@fernleaf/shared`): tsup → `dist/{cjs,esm}` + d.ts; Vitest; zod, date-fns, @date-fns/tz, @casl/ability; folders `permissions/ authz/ contracts/ domain/ errors.ts`.
  *Accept:* a sample domain test passes; both apps can import it.
- [x] **T-103** `backend` (`@fernleaf/backend`): Nest 11, global prefix `/api`, Zod env config, `GET /api/health` (no DB) + `/api/health/ready`, helmet, cookie-parser, global exception filter → error envelope, Zod validation pipe (nestjs-zod).
  *Accept:* `curl /api/health` → `{ ok: true }`; an invalid body → 400 envelope.
- [ ] **T-104** Prisma 7: `prisma.config.ts` (dotenv), generator `prisma-client` + `output` + `moduleFormat = "cjs"`, `@prisma/adapter-pg`, PrismaService. Schema draft v1 from `docs/DATABASE_MODELS.md` §4 → `prisma validate` → first migration on the Neon `dev` branch; CHECK-constraint migration (§5).
  *Accept:* migration applied; `/api/health/ready` → DB ok.
- [ ] **T-105** `frontend` (`@fernleaf/frontend`): Next 16 App Router, Tailwind 4, `shadcn init`, TanStack Query provider, `lib/api-client.ts`, `next.config.ts` rewrites `/api/:path*` → `${API_ORIGIN}/api/:path*`, `proxy.ts` (cookie-presence redirect), base layout.
  *Accept:* the web app calls `/api/health` through the rewrite locally.
- [ ] **T-106** ESLint 9 flat config + typescript-eslint + Prettier across the workspace; `pnpm lint` and `pnpm typecheck` clean.
- [ ] **T-107** GitHub Actions `ci.yml`: install → lint → typecheck → test (shared domain tests in a TZ matrix: UTC, America/Los_Angeles, Asia/Kolkata) → build.
- [ ] **T-108** Provision **Neon** (project `fernleaf-kitchen-ops`, Singapore, PG17, 0.25 CU fixed, branches `dev`/`test`), **Render** (Singapore, free, build/start commands per TRD §13.2, health path `/api/health`, env), **Vercel** (root `frontend`, `API_ORIGIN`). Deploy the skeleton.
  *Accept:* the live web URL shows the health status fetched through `/api`. URLs recorded in [[Environments and Deploy]].
- [ ] **T-109** UptimeRobot HTTP monitor → `https://<api>/api/health` every 5 min.
- [ ] **T-110** *(optional)* `pnpm vault:commits`: regenerate [[Commit Log]] from `git log`.

## Exit criteria

- [ ] CI green on `main`
- [ ] Live web → API → DB path works on the free tiers
- [ ] `docs/DATABASE_MODELS.md` schema validated (fixes logged as ADRs if any)
- [ ] [[Tech Stack]] records the resolved versions; [[Runbook]] commands confirmed

## Risks

- Prisma 7 + Nest CJS friction (time-box 45 min; follow the official Nest recipe)
- Vercel build of the shared package (use `pnpm --filter @fernleaf/frontend... build` or `transpilePackages`)

## Log

- 2026-10-03 02:12: T-101 done (87abdf9). Version pins decided (ADR-024).
- 2026-10-03 02:16: T-102 done. shared builds CJS + ESM + d.ts; money helpers with BR-PRC-03/BR-MNY-01 tests (11 passing). Hit the TS 6 baseUrl deprecation in the tsup dts build (Gotchas).
- 2026-10-03 02:25: T-103 done. Nest 11 API: `/api` prefix, Zod env validation, helmet, cookie-parser, global ZodValidationPipe and ApiExceptionFilter (one error envelope; codes and statuses from `shared/src/errors.ts`), DB-free `/api/health`. 4 supertest tests pass; built server verified with curl. Replaced unplugin-swc (native addon broken on Windows) with a TS-transpile Vitest plugin.

## Outcome
