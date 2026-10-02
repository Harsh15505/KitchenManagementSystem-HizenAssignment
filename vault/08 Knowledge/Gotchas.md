---
type: reference
updated: 2026-10-03 01:45 IST
---

# ⚠️ Gotchas

Read these before touching the related area. **Add a new entry every time something bites.** Include the date and where it bit.

## Prisma 7

- Generator `provider = "prisma-client"` with a **required `output`** (we use `backend/src/generated/prisma`, git-ignored). Import `PrismaClient` from that path, **not** `@prisma/client`.
- NestJS compiles to CommonJS → set `moduleFormat = "cjs"` (the ESM client uses `import.meta`).
- The datasource URL lives in **`prisma.config.ts`**, not `schema.prisma`. Env vars are **not auto-loaded** there, so `import 'dotenv/config'`.
- A **driver adapter is required**: `new PrismaPg({ connectionString })` from `@prisma/adapter-pg`, passed as `super({ adapter })`.
- **Pin `prisma@^7` / `@prisma/client@^7`.** The Nest docs warn that another npm tag may point to a Prisma 8 pre-release.
- `@db.Date` columns come back as JS `Date` at **UTC midnight**. Only use `toDbDate()` / `fromDbDate()`.
- `updateManyAndReturn` (PostgreSQL) needs Prisma ≥ 6.2. We use it in cut-off processing.
- CHECK constraints are hand-written SQL in migrations. **Review every new migration for unexpected `DROP`s.**
- Map P2002 to 409; read `meta.target` / the constraint name to choose a specific error code (e.g. `ALREADY_INVOICED`).

## Next.js 16

- **`middleware.ts` is now `proxy.ts`** (export `proxy`, Node runtime). Exclude `/api` and static assets in the matcher.
- `rewrites()` reads env at **build time**: set `API_ORIGIN` in Vercel before deploying.
- Cookies set by the API come back through the rewrite. **Don't** set a `Domain` attribute.

## NestJS 11

- Express 5 changed wildcard routes (`*splat`).
- Vitest needs decorator metadata for Nest DI. **We do not use `unplugin-swc`**: the SWC native addon failed to load on the Windows dev box (cache-folder DACL check, 2026-10-03, T-103). `backend/vitest.config.ts` instead transpiles test sources with `typescript.transpileModule` (`emitDecoratorMetadata`). It is pure JS, so it works the same in Linux CI.
- Every route must carry `@CheckPolicies` or `@Public` (the boot check fails otherwise, by design).

## Time

- Never call `getDay()` / `getDate()` on a business date. Use `isoWeekday(CalendarDate)` and `toKitchenDate(instant)`.
- Format instants in the UI with `Intl.DateTimeFormat(..., { timeZone: 'Asia/Kolkata' })`.
- Domain tests must pass under `TZ=UTC`, `TZ=America/Los_Angeles` and `TZ=Asia/Kolkata`.

## Free tiers

- **Render free:** spin-down after 15 min without inbound traffic; ~1 min cold start; **750 instance-h/month per workspace**; ephemeral filesystem (never store uploads on disk).
- **Neon free:** **100 CU-h/month**, 0.5 GB storage, scale-to-zero after 5 min (can't be disabled). `/api/health` must stay DB-free. Attach an error handler to the pg pool (idle connections are killed on suspend). Use **transaction-scoped** advisory locks only.
- **UptimeRobot** free: 5-min interval minimum, which is fine (< 15 min).

## Monorepo / tooling

- `@fernleaf/shared` must build before the apps: `pnpm -r build` runs in dependency order, and `pnpm --filter <pkg>... build` builds a package plus its dependencies. Optionally `transpilePackages` in Next.
- Render needs `corepack enable` for pnpm; set `packageManager` in the root `package.json`.
- Windows: `.gitattributes` forces LF. Vault file names contain spaces, so quote paths in shells.
- Zod 4: `@hookform/resolvers` ≥ 5, `nestjs-zod` ≥ 5.

- **TypeScript 6 + tsup** (2026-10-03, T-102): tsup's dts build injects `baseUrl`, which TS 6 rejects (TS5101). Fixed with `dts: { compilerOptions: { ignoreDeprecations: "6.0" } }` in `shared/tsup.config.ts`.
- **npm latest tags** (2026-10-03): `prisma@latest` is 8.0 RC and `@nestjs/core@latest` is 12 (ESM-only). Always install with explicit versions (ADR-024).

## CASL (ADR-023)

- **Prisma 7:** `@casl/prisma`'s default entry imports model types from `@prisma/client`, which no longer re-exports our models. Wrap `@casl/prisma/runtime` with the generated client types (CASL README → "Custom PrismaClient output path").
- Build abilities **only from permission codes** (`shared/src/authz/rules.ts` → `buildRules`). Never `if (role === 'admin')`.
- Keep rule conditions to simple equalities (`{ driverId: user.id }`), so the Prisma ability (backend) and the Mongo ability (frontend) behave the same.
- Abilities answer "may this user attempt this?". State rules (only Confirmed orders can be cooked; locked after cut-off) stay in domain functions.
- Out-of-scope single records → **404** (load them through `accessibleBy`), so the API doesn't reveal that they exist.
