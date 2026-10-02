---
type: reference
updated: 2026-10-03 01:45 IST
---

# 🧰 Tech Stack

The full rationale is in `docs/TRD.md` §2 and [[Decision Log]]. **Fill in the "Resolved version" column during T-101…T-105**, using the exact versions from the lockfile.

| Layer | Package | Target | Resolved version | Notes |
|---|---|---|---|---|
| Runtime | Node.js | 22 LTS | 22.13.1 (local) | `.nvmrc`, `engines` |
| Package manager | pnpm workspaces (no Turborepo) | 10 | pnpm 10.33.0 (local) | `packageManager` field; `corepack enable` on Render; folders `frontend/`, `backend/`, `shared/` |
| Language | TypeScript | current stable (strict) | _tbd_ | `noUncheckedIndexedAccess` |
| Frontend | next / react | 16.x / 19.x | _tbd_ | `proxy.ts`, App Router, rewrites |
| UI | tailwindcss / shadcn | 4.x / latest CLI | _tbd_ | components in `frontend/src/components/ui` |
| Client data | @tanstack/react-query / react-table | 5 / 8 | _tbd_ | |
| Forms | react-hook-form / @hookform/resolvers | 7 / ≥ 5 | _tbd_ | Zod 4 support |
| Backend | @nestjs/* | 11.x | _tbd_ | Express 5 adapter |
| Validation | zod / nestjs-zod | 4.x / 5.x | _tbd_ | shared schemas |
| Auth | @nestjs/jwt, cookie-parser, bcryptjs, @nestjs/throttler | latest | _tbd_ | |
| Authorisation | @casl/ability · @casl/prisma · @casl/react | latest | _tbd_ | abilities from permission codes; Prisma 7 runtime wrapper (ADR-023) |
| Jobs | @nestjs/schedule | latest | _tbd_ | timers only, no polling (ADR-013) |
| ORM | prisma / @prisma/client / @prisma/adapter-pg | **^7** (pin) | _tbd_ | `prisma-client` generator, `moduleFormat = "cjs"` |
| DB | PostgreSQL (Neon) | 17 | _tbd_ | Singapore |
| Dates | date-fns / @date-fns/tz | 4 / latest | _tbd_ | `TZDate` |
| Tests | vitest / unplugin-swc / supertest | latest | _tbd_ | TZ matrix in CI |
| Lint | eslint / typescript-eslint / prettier | 9 / latest / 3 | _tbd_ | flat config |
